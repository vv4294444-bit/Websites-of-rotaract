-- Run this once in Supabase > SQL Editor.
-- Public visitors can read club_content. Only user IDs manually inserted into site_admins can add/remove rows.
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.club_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event','project')),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 280),
  category text not null default 'Community service',
  event_date date,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
alter table public.club_content enable row level security;
grant select on public.site_admins to authenticated;
grant select on public.club_content to anon, authenticated;
grant insert, delete on public.club_content to authenticated;

create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.site_admins where user_id = auth.uid()); $$;

 drop policy if exists "Admins can read their own membership" on public.site_admins;
create policy "Admins can read their own membership" on public.site_admins
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Anyone can view club content" on public.club_content;
create policy "Anyone can view club content" on public.club_content
for select to anon, authenticated using (true);

drop policy if exists "Admins can publish club content" on public.club_content;
create policy "Admins can publish club content" on public.club_content
for insert to authenticated with check (public.is_site_admin());

drop policy if exists "Admins can remove club content" on public.club_content;
create policy "Admins can remove club content" on public.club_content
for delete to authenticated using (public.is_site_admin());

-- After the site owner signs in once with their magic link, run this separately in Supabase SQL editor:
insert into public.site_admins (user_id)
select id from auth.users where lower(email) = lower('rotaractclubvasavisfw@gmail.com')
on conflict (user_id) do nothing;
