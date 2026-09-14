# SPOTA — Production-Readiness Implementation Plan
*Summary version for Claude Code / engineering execution — Sept 2026. Full detail and rationale: `spota-production-readiness-plan.md` in the project.*

## Status at a glance

| # | Item | Status |
|---|---|---|
| 1–4 | P0 — Supabase RLS/storage security holes | Code done, **not yet applied to live DB** |
| 5 | Automated tests (Vitest) | Done, verified passing (32 tests) |
| 6 | CI (`ci.yml`) | Done, **blocked from write — delivered as file** |
| 7 | Env config (`.env` support) | Done |
| 8 | Sentry scaffold | Done, inactive until DSN set |
| 9 | Agency payment flow | Decision made: stay mocked, already unlinked from nav |
| 10 | Positioning (Gurgaon vs pan-India) | Decision made: pan-India confirmed, nothing stale in-repo |
| 11 | iOS platform | Decision made: in scope, dependency added, CLI step pending |
| 12 | Android release signing | Not started |
| 13 | Content moderation scaling | Not started |
| 14 | DPDP / privacy policy | Not started |
| — | P3 (backups, analytics, perf, agent reconciliation) | Not started |

## Manual steps — only Rahul can do these

1. **Run `supabase_p0_security_fixes.sql`** in Supabase Dashboard → SQL Editor. Closes the 4 live P0 holes (unauthenticated spot writes, storage object takeover, spoofable admin check, public moderation weights).
2. **Bootstrap the first admin** — uncomment and run the last line of that same file with your account email:
   ```sql
   update public.profiles set is_admin = true
     where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
   ```
3. **Run `npm install`** locally — pulls in the new test deps (`vitest`, `jsdom`, `fake-indexeddb`, `@testing-library/*`), `@sentry/react`, and `@capacitor/ios`.
4. **Save the 2 blocked files** delivered separately: `.env.local` → repo root; `ci.yml` → `.github/workflows/ci.yml`.
5. **Optional, when ready for iOS:**
   ```
   npx cap add ios
   npx cap sync ios
   npx cap open ios   # needs a Mac + Xcode
   ```

## Engineering backlog (in priority order)

### P2 — before app store submission
- **Android release signing**: generate + securely store a release keystore (`android/app/build.gradle` is currently debug-oriented). Losing the keystore later blocks all future updates to the same listing.
- **Content moderation scaling**: rate-limit anonymous inserts (Supabase Edge Function or edge proxy rule); make `verification_rules` auto-scoring the primary gate, manual review the exception queue.
- **DPDP / privacy policy**: draft privacy policy + consent flow + data-retention policy. Required for Play Store submission (needs a privacy policy URL) and for DPDP compliance claims to investors.

### P3 — post-launch
- Confirm Supabase point-in-time recovery is enabled before real user data accumulates.
- Build a dashboard/BI layer on top of the existing `analytics_events` table.
- Split `LandingView.jsx` (62KB) / `AgencyDashboardView.jsx` (47KB) if load time becomes a complaint.
- Reconcile the two Claude Code agent systems in this repo (`.agents/agents/spota-*` vs the 264-persona library at `.claude/agents/`) so a bare persona name resolves predictably.

### Known minor bug (not blocking)
`src/lib/offlineCache.js` → `saveOfflineZone()` derives each zone id from `Date.now()` alone (`zone_${Date.now()}`). Two zone-download actions completing in the same millisecond would collide. Low probability, one-line fix when convenient:
```js
const zoneId = `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

## Suggested sequence

| When | Focus |
|---|---|
| Now | Manual steps 1–4 above — nothing else matters until the P0 SQL is live |
| This week | Android release signing (parallel, no dependency on the above) |
| Next | Content moderation scaling + DPDP/privacy policy — can run in parallel |
| When ready | iOS platform setup (manual step 5) |
| Post-launch | P3 backlog |
