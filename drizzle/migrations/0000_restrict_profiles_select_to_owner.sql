drop policy if exists "Profiles are viewable by everyone" on public.profiles;

create policy "Users read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);