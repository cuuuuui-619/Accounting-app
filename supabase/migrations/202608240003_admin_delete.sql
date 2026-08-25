create or replace function public.admin_delete_ledger(p_ledger_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.ledgers
  where id = p_ledger_id;

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.admin_delete_ledger(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_ledger(uuid) to service_role;
