create extension if not exists pgcrypto;

create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_members (
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

create table if not exists public.ledger_records (
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  record_type text not null check (record_type in ('transaction', 'budget', 'project', 'loan')),
  record_id text not null check (char_length(record_id) between 1 and 160),
  payload jsonb,
  deleted_at timestamptz,
  updated_at timestamptz not null,
  updated_by uuid references auth.users(id) on delete set null,
  primary key (ledger_id, record_type, record_id),
  check ((deleted_at is null and jsonb_typeof(payload) = 'object') or (deleted_at is not null and payload is null))
);

create index if not exists ledger_members_user_id_idx on public.ledger_members(user_id);
create index if not exists ledger_records_ledger_updated_idx on public.ledger_records(ledger_id, updated_at desc);

alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.ledger_records enable row level security;
alter table public.ledger_records replica identity full;

create or replace function public.is_ledger_member(target_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ledger_members
    where ledger_id = target_ledger_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_ledger(p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ledger_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_code_hash';
  end if;

  insert into public.ledgers (code_hash, created_by)
  values (p_code_hash, auth.uid())
  returning id into new_ledger_id;

  insert into public.ledger_members (ledger_id, user_id)
  values (new_ledger_id, auth.uid());

  return new_ledger_id;
end;
$$;

create or replace function public.join_ledger(p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ledger_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_code_hash';
  end if;

  select id into target_ledger_id
  from public.ledgers
  where code_hash = p_code_hash;

  if target_ledger_id is null then
    raise exception 'invalid_sync_code';
  end if;

  insert into public.ledger_members (ledger_id, user_id)
  values (target_ledger_id, auth.uid())
  on conflict do nothing;

  return target_ledger_id;
end;
$$;

create or replace function public.apply_ledger_mutation(
  p_ledger_id uuid,
  p_record_type text,
  p_record_id text,
  p_payload jsonb,
  p_deleted boolean,
  p_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ledger_member(p_ledger_id) then
    raise exception 'ledger_access_denied';
  end if;
  if p_record_type not in ('transaction', 'budget', 'project', 'loan') then
    raise exception 'invalid_record_type';
  end if;
  if char_length(p_record_id) not between 1 and 160 then
    raise exception 'invalid_record_id';
  end if;
  if p_updated_at > now() + interval '5 minutes' then
    raise exception 'invalid_updated_at';
  end if;
  if (p_deleted and p_payload is not null) or (not p_deleted and jsonb_typeof(p_payload) <> 'object') then
    raise exception 'invalid_payload';
  end if;

  insert into public.ledger_records (
    ledger_id, record_type, record_id, payload, deleted_at, updated_at, updated_by
  ) values (
    p_ledger_id,
    p_record_type,
    p_record_id,
    case when p_deleted then null else p_payload end,
    case when p_deleted then p_updated_at else null end,
    p_updated_at,
    auth.uid()
  )
  on conflict (ledger_id, record_type, record_id) do update
    set payload = excluded.payload,
        deleted_at = excluded.deleted_at,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    where excluded.updated_at >= public.ledger_records.updated_at;

  return true;
end;
$$;

drop policy if exists "members can read ledgers" on public.ledgers;
create policy "members can read ledgers"
on public.ledgers for select to authenticated
using (public.is_ledger_member(id));

drop policy if exists "members can read own membership" on public.ledger_members;
create policy "members can read own membership"
on public.ledger_members for select to authenticated
using (user_id = auth.uid());

drop policy if exists "members can read ledger records" on public.ledger_records;
create policy "members can read ledger records"
on public.ledger_records for select to authenticated
using (public.is_ledger_member(ledger_id));

revoke all on public.ledgers, public.ledger_members, public.ledger_records from anon, authenticated;
grant select on public.ledgers, public.ledger_members, public.ledger_records to authenticated;

revoke all on function public.is_ledger_member(uuid) from public, anon;
revoke all on function public.create_ledger(text) from public, anon;
revoke all on function public.join_ledger(text) from public, anon;
revoke all on function public.apply_ledger_mutation(uuid, text, text, jsonb, boolean, timestamptz) from public, anon;
grant execute on function public.is_ledger_member(uuid) to authenticated;
grant execute on function public.create_ledger(text) to authenticated;
grant execute on function public.join_ledger(text) to authenticated;
grant execute on function public.apply_ledger_mutation(uuid, text, text, jsonb, boolean, timestamptz) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.ledger_records;
exception
  when duplicate_object then null;
end $$;
