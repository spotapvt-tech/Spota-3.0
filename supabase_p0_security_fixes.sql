-- ============================================================
-- SPOTA — P0 SECURITY FIXES
-- Run this entire file in the Supabase SQL Editor:
--   Supabase Dashboard → your project → SQL Editor → New query → paste → Run
-- Idempotent — safe to run more than once (uses IF EXISTS / IF NOT EXISTS).
--
-- Fixes, in order:
--   1. Anyone (including anonymous requests) could update ANY spot's data,
--      including flipping its moderation `status` — supabase_rls_setup.sql's
--      `using (true) with check (true)` policy, plus a logic bug in the
--      original schema's "owners or admins" policy that actually granted
--      update rights to every logged-in user, not just admins.
--   2. Anyone could delete or overwrite any other user's uploaded photos/videos
--      in Storage (spot-images / spot-videos buckets had no ownership check).
--   3. The admin panel's access check was a client-side email string match
--      (`user.email?.includes('admin')`) with no server-side enforcement —
--      this adds a real, server-controlled is_admin flag.
--   4. The auto-moderation scoring weights/thresholds (verification_rules)
--      were publicly readable, making the approval algorithm easy to game.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add a real is_admin flag to profiles.
--    No RLS UPDATE policy grants authenticated users write access to this
--    column — it can only be set from the Supabase dashboard/SQL editor,
--    which is exactly what step 5 below does.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ------------------------------------------------------------
-- 2. Fix the spots UPDATE policy.
-- ------------------------------------------------------------
drop policy if exists "Allow anyone to update spots" on public.spots;
drop policy if exists "Allow owners or admins to update spots" on public.spots;

create policy "Owners can update their own spots"
  on public.spots for update
  using (auth.uid() = user_id);

create policy "Admins can update any spot"
  on public.spots for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));

-- ------------------------------------------------------------
-- 3. Lock down storage buckets to the uploading owner (plus admins).
--    Insert (upload) and select (read/view) stay open, so guest gem-drops
--    and public viewing keep working exactly as before — only update/delete
--    of someone else's file is now blocked.
--    Note: Supabase Storage sets `owner` to auth.uid() automatically for
--    authenticated uploads. A file uploaded anonymously has no owner, so
--    only admins (not the original anonymous uploader) can edit/delete it —
--    that's the safe direction for this to fail in.
-- ------------------------------------------------------------
drop policy if exists "Allow public updates to spot-images" on storage.objects;
drop policy if exists "Allow public deletions from spot-images" on storage.objects;
drop policy if exists "Allow public updates to spot-videos" on storage.objects;
drop policy if exists "Allow public deletions from spot-videos" on storage.objects;

create policy "Owners can update their own spot-images"
  on storage.objects for update to authenticated
  using (bucket_id = 'spot-images' and owner = auth.uid());
create policy "Owners can delete their own spot-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'spot-images' and owner = auth.uid());

create policy "Owners can update their own spot-videos"
  on storage.objects for update to authenticated
  using (bucket_id = 'spot-videos' and owner = auth.uid());
create policy "Owners can delete their own spot-videos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'spot-videos' and owner = auth.uid());

create policy "Admins can update any spot-images file"
  on storage.objects for update to authenticated
  using (bucket_id = 'spot-images' and exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));
create policy "Admins can delete any spot-images file"
  on storage.objects for delete to authenticated
  using (bucket_id = 'spot-images' and exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));
create policy "Admins can update any spot-videos file"
  on storage.objects for update to authenticated
  using (bucket_id = 'spot-videos' and exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));
create policy "Admins can delete any spot-videos file"
  on storage.objects for delete to authenticated
  using (bucket_id = 'spot-videos' and exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));

-- ------------------------------------------------------------
-- 4. Restrict verification_rules (auto-moderation scoring config) to admins.
-- ------------------------------------------------------------
drop policy if exists "Verification rules are readable by everyone" on public.verification_rules;

create policy "Only admins can read verification rules"
  on public.verification_rules for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));

-- ------------------------------------------------------------
-- 5. Make yourself the first admin.
--    Edit the email below to your own Spota account's email, then run just
--    this statement (select it and run separately, or uncomment and re-run
--    the whole file).
-- ------------------------------------------------------------
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
