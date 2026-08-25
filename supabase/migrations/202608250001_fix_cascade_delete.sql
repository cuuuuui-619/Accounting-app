-- 修复外键级联删除：将 updated_by 从 ON DELETE CASCADE 改为 ON DELETE SET NULL，防止共享账本协作者注销时导致他人账目数据丢失
alter table public.ledger_records
  alter column updated_by drop not null;

alter table public.ledger_records
  drop constraint if exists ledger_records_updated_by_fkey,
  add constraint ledger_records_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;
