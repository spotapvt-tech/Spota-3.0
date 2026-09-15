# SPOTA — Production-Readiness Plan
*Prepared from a full codebase audit, September 2026*

## Verdict

SPOTA is feature-complete against its 9-feature PRD roadmap and has real infrastructure (Supabase, Capacitor, Vercel). It is **not safe to open to real users yet** — there are live data-integrity holes in the database layer that let any visitor vandalize or wipe other users' content. Those come first, everything else is sequenced after.

---

## P0 — Fix before a single real user touches this (est. 1–3 days)

These are exploitable *today* against your live Supabase project, not hypothetical risks.

### 1. Anyone can rewrite or destroy any spot
`supabase_rls_setup.sql`:
```sql
create policy "Allow anyone to update spots" on public.spots for update using (true) with check (true);
```
This policy (applied after the schema's original, safer one) lets **anonymous, unauthenticated requests** update every column of every row in `spots` — title, description, `status`, `reactions`, everything. Someone can deface every spot in the app, or flip `status` to bypass your moderation pipeline entirely, with a single unauthenticated API call.

The schema's own earlier version (`supabase_complete_schema.sql` line 382) is also wrong, just less obviously:
```sql
create policy "Allow owners or admins to update spots" ... using (auth.uid() = user_id or auth.uid() is not null);
```
`auth.uid() is not null` is true for *any* logged-in user, not just admins — the "admin" half of this condition grants every signed-up user update rights on every other user's spots.

**Fix:** drop both, replace with:
```sql
drop policy if exists "Allow anyone to update spots" on public.spots;
drop policy if exists "Allow owners or admins to update spots" on public.spots;

create policy "Owners can update their own spots"
  on public.spots for update
  using (auth.uid() = user_id);

create policy "Admins can update any spot"
  on public.spots for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
```
(Requires adding a real `is_admin boolean` column to `profiles` — see item 3.)

### 2. Anyone can delete or overwrite anyone's photos/videos
`supabase_complete_schema.sql` lines 652–690: the `spot-images` and `spot-videos` storage buckets grant `update` and `delete` `to anon, authenticated` with no ownership check — just `bucket_id = 'spot-images'`. Any visitor, logged in or not, can delete or replace any file in either bucket.

**Fix:** scope to the object owner using storage object metadata (`owner` column Supabase sets automatically), e.g.:
```sql
create policy "Owners can update their own spot-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'spot-images' and owner = auth.uid());

create policy "Owners can delete their own spot-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'spot-images' and owner = auth.uid());
```
Same pattern for `spot-videos`. Keep insert/select open if guest uploads are wanted, but insert should probably require auth too — anonymous write access to storage is an open door for abuse/cost (someone can fill your bucket with junk).

### 3. Admin panel has no real access control
`AdminView.jsx`:
```js
const isAdmin = user.email?.endsWith('@spota.local') || user.email?.includes('admin');
```
This is a client-side string check only — it hides a button, nothing more. Two problems: (a) it's trivial to bypass by calling the Supabase queries directly, and (b) `.includes('admin')` matches `notanadmin@gmail.com`, `bad-admin@x.com`, etc. Combined with items 1–2 above, an "admin" self-declared this way currently has real destructive power.

**Fix:** add `is_admin boolean default false` to `profiles`, set it server-side only (never client-writable — no RLS update policy on that column from the client), and gate every admin action (moderation writes, `verification_rules` writes) behind RLS checks against it, not against email strings.

### 4. Moderation algorithm is publicly readable
`verification_rules` table: `"Verification rules are readable by everyone" using (true)` — no auth required. The exact auto-approval weights and thresholds you saw in `AdminView.jsx` (visual 25%, popularity 25%, threshold_approved 75, etc.) are fetchable by anyone, which means anyone can reverse-engineer exactly how to game auto-approval.

**Fix:** restrict select to admins only, same `is_admin` check as above.

---

## P1 — Before broader beta / marketing push (est. 1–2 weeks)

### 5. No automated tests exist
No `__tests__`, no vitest/jest/playwright in `package.json`. For a 5-step wizard, real-time trip sync, offline caching, and a badge/gamification engine, regressions will be silent. Minimum bar before wider testing:
- Vitest + React Testing Library for `gemService.js`, `badgeEngine.js`, `offlineCache.js`, `safeTrekTimer.js` (pure logic, cheap to test, highest regression risk)
- One Playwright smoke test: sign up → drop a gem → see it on the map

### 6. No CI
No `.github/workflows` in this repo (unlike the agency-agents library you just installed, which has real CI). `npm run lint` and `npm run build` should run on every PR at minimum, before tests exist and definitely once they do.

### 7. Environment config isn't environment-config
`src/lib/supabaseClient.js` hardcodes the Supabase URL and anon key directly in source. The anon key is meant to be public, so this isn't a secrets leak — but it means there's no way to point a staging build at a staging Supabase project without editing source. Also: `.gitignore` has no `.env*` entry at all, so if anyone *does* add a `.env` later (e.g. a Stripe secret key for item 9), it'll get committed by default.

**Fix:** move to `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, add `.env` / `.env.local` to `.gitignore` now, before it matters.

### 8. No error monitoring
Nothing catches production errors (no Sentry or equivalent). Given real-time chat, offline sync, and payment UI all exist, silent failures will be invisible until a user complains. Add Sentry (or similar) before beta — it's a 15-minute integration and the highest-leverage item on this list per hour spent.

### 9. Agency payment flow is a UI mock, not payments
`AgencyDashboardView.jsx` — `handleCheckoutSubmit` collects a raw card number/expiry/CVV into a plain `<input>` and "processes" it with a `setTimeout`; the label literally says "Simulated sandbox transaction." Nothing is wrong *today* because nothing is sent anywhere — but this must never be wired directly to a backend. Before this monetization surface goes live:
- Replace the raw card inputs with **Stripe Elements or Stripe Checkout** (hosted, PCI scope stays with Stripe)
- Real subscription/webhook handling via a Supabase Edge Function
- Until then, keep `AgencyDashboardView` explicitly unlinked from any real onboarding funnel

### 10. Positioning drift
Investor/brand material (per your memory) still frames SPOTA as Gurgaon-only hyperlocal discovery. The actual PRD (`docs/Spota_PRD_Enhancement.md`) and the live landing page demo content (Kasol, Old Manali, Triund) describe a pan-India travel + trekking safety companion. Decide which one is true before it goes in front of investors or app store copy — they imply different TAM, different marketing, different App Store category.

---

## P2 — Before app store submission (est. 1–2 weeks, can run parallel to P1)

### 11. iOS doesn't exist
Only `android/` is present — no `ios/` Capacitor platform. If iOS is in scope for launch, `npx cap add ios` plus a signed provisioning profile / App Store Connect setup is a from-scratch task, not a tweak.

### 12. Android release signing not set up
`android/app/build.gradle` and `local.properties` show a debug-oriented setup; no signing config visible for a release keystore. Play Store requires a signed release build — generate and securely store a keystore before submission (losing it later means you can never update the app under the same listing).

### 13. Content moderation won't scale past manual review
`AdminView.jsx`'s moderation tab is a manual queue. With open anonymous inserts on spots/comments (by design, for low-friction contribution) and no rate limiting, spam/abuse volume will outpace one person clicking through the queue as soon as there's real traffic. At minimum: rate-limit anonymous inserts per IP/session (Supabase Edge Function in front of inserts, or a Cloudflare rule if traffic is proxied), and treat the `verification_rules` auto-scoring as the primary gate, manual review as the exception queue — not the reverse.

### 14. DPDP / privacy compliance
Referenced as a requirement in your own product docs but no privacy policy, consent flow, or data-retention policy found in the repo. Needed before Play Store submission (Play Store requires a privacy policy URL) and before DPDP compliance can be claimed to investors.

---

## P3 — Scale readiness (after launch, not before)

- Backups: confirm Supabase project has point-in-time recovery enabled (paid tier requirement) before real user data accumulates
- Analytics: `analytics_events` table exists and is logged to, but no dashboard/BI layer consumes it yet
- Performance budget: `LandingView.jsx` (62KB source) and `AgencyDashboardView.jsx` (47KB) are large single-file components — fine at current scale, worth splitting if load time becomes a complaint
- Reconcile the two agent systems now both present in this repo — your existing `.agents/agents/spota-*` team and the 264-persona library just installed at `.claude/agents/` — so it's clear which one a bare persona name resolves to

---

## Suggested sequence

| Week | Focus |
|---|---|
| 1 | P0 items 1–4 (all Supabase RLS/storage fixes — can ship as one migration file) |
| 1–2 | P1 items 5–8 (tests for critical libs, CI, env vars, Sentry) — run alongside P0 |
| 2–3 | P1 items 9–10 (payment flow decision, positioning decision) — these are product/business decisions as much as engineering |
| 3–4 | P2 (iOS if in scope, Android signing, moderation scaling, DPDP/privacy policy) |
| Post-launch | P3 |

**This week, in order:** ship the P0 SQL migration (items 1–4) — it's a single file, no product tradeoffs, and it's the only thing on this list where real users could get actively hurt (their content deleted, their photos wiped) if you launch without it.
