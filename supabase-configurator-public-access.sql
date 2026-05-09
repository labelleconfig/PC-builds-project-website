-- Public read access for the GitHub Pages configurator.
-- Run this in Supabase SQL Editor after the ERP direct-sales migrations.

grant select on public.config_templates to anon;
grant select on public.config_base_components to anon;
grant select on public.config_options to anon;

drop policy if exists "Anon can read config templates" on public.config_templates;
create policy "Anon can read config templates"
on public.config_templates
for select
to anon
using (true);

drop policy if exists "Anon can read config base components" on public.config_base_components;
create policy "Anon can read config base components"
on public.config_base_components
for select
to anon
using (true);

drop policy if exists "Anon can read config options" on public.config_options;
create policy "Anon can read config options"
on public.config_options
for select
to anon
using (true);
