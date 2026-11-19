revoke all on public.phone_compliance_checks from public, anon, authenticated;
grant select on public.phone_compliance_checks to authenticated;
grant all on public.phone_compliance_checks to service_role;
revoke all on public.user_dnc_numbers from public, anon, authenticated;
grant select, insert, update, delete on public.user_dnc_numbers to authenticated;
grant all on public.user_dnc_numbers to service_role;