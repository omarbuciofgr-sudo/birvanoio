create table public.phone_compliance_checks (
 phone text primary key check (phone ~ '^[0-9]{10}$'),
 on_national_dnc boolean,
 tcpa_litigator boolean,
 line_type text,
 source text not null default 'batchdata',
 checked_at timestamptz not null default now()
);
grant select on public.phone_compliance_checks to authenticated;
grant all on public.phone_compliance_checks to service_role;
alter table public.phone_compliance_checks enable row level security;
create policy "Signed-in readers of phone compliance" on public.phone_compliance_checks for select to authenticated using ((select auth.uid()) is not null);

create table public.user_dnc_numbers (
 user_id uuid not null default auth.uid(),
 phone text not null check (phone ~ '^[0-9]{10}$'),
 reason text,
 created_at timestamptz not null default now(),
 primary key (user_id, phone)
);
grant select, insert, update, delete on public.user_dnc_numbers to authenticated;
grant all on public.user_dnc_numbers to service_role;
alter table public.user_dnc_numbers enable row level security;
create policy "Users manage their own phone suppression" on public.user_dnc_numbers for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.record_lead_phone_suppression() returns trigger language plpgsql security definer set search_path = '' as $$
declare digits text;
begin
 if not new.do_not_contact or new.phone is null or new.client_id is null then return new; end if;
 digits := regexp_replace(new.phone, '[^0-9]', '', 'g');
 if digits ~ '^1[0-9]{10}$' then digits := substring(digits from 2); end if;
 if digits ~ '^[0-9]{10}$' then
  insert into public.user_dnc_numbers (user_id, phone, reason) values (new.client_id, digits, coalesce(new.do_not_contact_reason, 'Lead marked do not contact')) on conflict do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.record_lead_phone_suppression() from public, anon, authenticated;
create trigger record_lead_phone_suppression after insert or update of do_not_contact, phone on public.leads for each row execute function public.record_lead_phone_suppression();
insert into public.user_dnc_numbers (user_id, phone, reason)
select client_id, regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'), '^1([0-9]{10})$', '\1'), coalesce(do_not_contact_reason, 'Lead marked do not contact') from public.leads
where do_not_contact and client_id is not null and regexp_replace(phone, '[^0-9]', '', 'g') ~ '^(1)?[0-9]{10}$' on conflict do nothing;

create function public.phone_compliance_counts() returns table (checked bigint, on_dnc bigint, litigators bigint, dnc_known bigint, tcpa_known bigint) language plpgsql stable security definer set search_path = '' as $$
begin
 if not coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
 return query select count(*), count(*) filter (where on_national_dnc), count(*) filter (where tcpa_litigator), count(on_national_dnc), count(tcpa_litigator) from public.phone_compliance_checks where checked_at > now() - interval '31 days';
end;
$$;
revoke all on function public.phone_compliance_counts() from public, anon;
grant execute on function public.phone_compliance_counts() to authenticated;