-- Add stock tracking and workbook review tables to an existing Racing Machine project.
-- Run after setup.sql in the Supabase SQL Editor.

begin;

create table if not exists public.inventory_costs (
  catalog_id uuid primary key
    references public.inventory_catalog(id) on delete cascade,
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  updated_at timestamptz not null default now()
);

insert into public.inventory_costs(catalog_id)
select id
from public.inventory_catalog
on conflict (catalog_id) do nothing;

alter table public.inventory_costs enable row level security;
revoke all on table public.inventory_costs from public, anon, authenticated;
grant select, update on table public.inventory_costs to authenticated;

drop policy if exists admin_inventory_costs_read on public.inventory_costs;
create policy admin_inventory_costs_read
  on public.inventory_costs for select to authenticated
  using ((select public.is_workshop_admin()));

drop policy if exists admin_inventory_costs_update on public.inventory_costs;
create policy admin_inventory_costs_update
  on public.inventory_costs for update to authenticated
  using ((select public.is_workshop_admin()))
  with check ((select public.is_workshop_admin()));

drop trigger if exists set_inventory_costs_updated_at on public.inventory_costs;
create trigger set_inventory_costs_updated_at
  before update on public.inventory_costs
  for each row execute function public.set_updated_at();

create or replace function public.create_inventory_catalog_item(
  p_item_kind text,
  p_code text,
  p_name text,
  p_brand text,
  p_condition text,
  p_category text,
  p_unit_cost numeric,
  p_suggested_price numeric,
  p_price_original numeric default null,
  p_price_generic numeric default null,
  p_price_repaired numeric default null,
  p_price_aftermarket numeric default null
)
returns public.inventory_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_item public.inventory_catalog;
begin
  if (select auth.uid()) is null
    or not (select public.is_workshop_admin())
  then
    raise exception 'Solo un administrador puede crear productos';
  end if;

  if p_unit_cost is null or p_unit_cost < 0
    or p_suggested_price is null or p_suggested_price < 0
  then
    raise exception 'El costo y el precio sugerido deben ser cero o mayores';
  end if;

  if p_item_kind = 'part' and (
    coalesce(p_price_original, p_suggested_price) <= 0
    or coalesce(p_price_generic, p_suggested_price) <= 0
    or coalesce(p_price_repaired, p_suggested_price) <= 0
    or coalesce(p_price_aftermarket, p_suggested_price) <= 0
  ) then
    raise exception 'Configura un precio mayor que cero para cada condición';
  end if;

  insert into public.inventory_catalog(
    item_kind, code, name, brand, condition, category, suggested_price,
    price_original, price_generic, price_repaired, price_aftermarket, created_by
  )
  values (
    p_item_kind, nullif(btrim(p_code), ''), btrim(p_name), nullif(btrim(p_brand), ''),
    nullif(p_condition, ''), nullif(p_category, ''),
    case when p_item_kind = 'part'
      then coalesce(p_price_original, p_suggested_price)
      else p_suggested_price
    end,
    coalesce(p_price_original, p_suggested_price),
    coalesce(p_price_generic, p_suggested_price),
    coalesce(p_price_repaired, p_suggested_price),
    coalesce(p_price_aftermarket, p_suggested_price),
    (select auth.uid())
  )
  returning * into saved_item;

  insert into public.inventory_costs(catalog_id, unit_cost)
  values (saved_item.id, p_unit_cost);

  return saved_item;
end;
$$;

revoke all on function public.create_inventory_catalog_item(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric
)
  from public, anon;
grant execute on function public.create_inventory_catalog_item(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric
)
  to authenticated;

create table if not exists public.inventory_stock (
  catalog_id uuid primary key
    references public.inventory_catalog(id) on delete cascade,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  updated_at timestamptz not null default now()
);

alter table public.inventory_stock enable row level security;
revoke all on table public.inventory_stock from public, anon, authenticated;
grant select on table public.inventory_stock to authenticated;

drop policy if exists authenticated_inventory_stock_read on public.inventory_stock;
create policy authenticated_inventory_stock_read
  on public.inventory_stock for select to authenticated
  using ((select auth.uid()) is not null);

drop trigger if exists set_inventory_stock_updated_at on public.inventory_stock;
create trigger set_inventory_stock_updated_at
  before update on public.inventory_stock
  for each row execute function public.set_updated_at();

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null
    references public.inventory_catalog(id) on delete restrict,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  direction text not null check (direction in ('in', 'out')),
  movement_type text not null
    check (movement_type in ('opening', 'purchase', 'manual_adjustment', 'consumption', 'return', 'other')),
  quantity integer not null check (quantity > 0),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists inventory_stock_movements_item_lookup
  on public.inventory_stock_movements(catalog_id, created_at desc);

alter table public.inventory_stock_movements enable row level security;
revoke all on table public.inventory_stock_movements from public, anon, authenticated;
grant select on table public.inventory_stock_movements to authenticated;

drop policy if exists authenticated_inventory_movements_read on public.inventory_stock_movements;
create policy authenticated_inventory_movements_read
  on public.inventory_stock_movements for select to authenticated
  using ((select auth.uid()) is not null);

create or replace function public.record_inventory_movement(
  p_catalog_id uuid,
  p_direction text,
  p_movement_type text,
  p_quantity integer,
  p_note text default ''
)
returns public.inventory_stock
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_quantity integer;
  saved_stock public.inventory_stock;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para registrar movimientos de inventario';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser un número entero mayor que cero';
  end if;

  if p_direction is null
    or p_movement_type is null
    or p_direction not in ('in', 'out')
    or p_movement_type not in ('opening', 'purchase', 'manual_adjustment', 'consumption', 'return', 'other')
    or (p_direction = 'out' and p_movement_type in ('opening', 'purchase', 'return'))
    or (p_direction = 'in' and p_movement_type = 'consumption')
  then
    raise exception 'El tipo y la dirección del movimiento no son válidos';
  end if;

  if p_note is not null and length(p_note) > 500 then
    raise exception 'La nota no puede superar 500 caracteres';
  end if;

  if not exists (
    select 1
    from public.inventory_catalog
    where id = p_catalog_id and active and item_kind = 'part'
  ) then
    raise exception 'Solo se puede mover stock de repuestos activos';
  end if;

  insert into public.inventory_stock(catalog_id)
  values (p_catalog_id)
  on conflict (catalog_id) do nothing;

  select quantity_on_hand
  into current_quantity
  from public.inventory_stock
  where catalog_id = p_catalog_id
  for update;

  if p_direction = 'out' and p_quantity > current_quantity then
    raise exception 'No hay existencias suficientes para registrar esta salida';
  end if;

  update public.inventory_stock
  set quantity_on_hand = current_quantity
      + case when p_direction = 'in' then p_quantity else -p_quantity end
  where catalog_id = p_catalog_id
  returning * into saved_stock;

  insert into public.inventory_stock_movements(
    catalog_id, recorded_by, direction, movement_type, quantity, note
  )
  values (
    p_catalog_id, (select auth.uid()), p_direction, p_movement_type, p_quantity, coalesce(p_note, '')
  );

  return saved_stock;
end;
$$;

revoke all on function public.record_inventory_movement(uuid, text, text, integer, text)
  from public, anon;
grant execute on function public.record_inventory_movement(uuid, text, text, integer, text)
  to authenticated;

create table if not exists public.inventory_import_drafts (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  raw_code text,
  raw_name text not null,
  raw_quantity text,
  raw_order_quantity text,
  suggested_brand text,
  suggested_condition text check (suggested_condition in ('new_original', 'new_generic', 'repaired', 'aftermarket')),
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'ignored')),
  inventory_catalog_id uuid references public.inventory_catalog(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_file, source_sheet, source_row),
  constraint reviewed_inventory_draft_has_catalog
    check (status <> 'reviewed' or inventory_catalog_id is not null)
);

create index if not exists inventory_import_drafts_status_lookup
  on public.inventory_import_drafts(status, source_sheet, source_row);

alter table public.inventory_import_drafts enable row level security;
revoke all on table public.inventory_import_drafts from public, anon, authenticated;
grant select, update on table public.inventory_import_drafts to authenticated;

drop policy if exists admin_inventory_import_drafts_read on public.inventory_import_drafts;
create policy admin_inventory_import_drafts_read
  on public.inventory_import_drafts for select to authenticated
  using ((select public.is_workshop_admin()));

drop policy if exists admin_inventory_import_drafts_update on public.inventory_import_drafts;
create policy admin_inventory_import_drafts_update
  on public.inventory_import_drafts for update to authenticated
  using ((select public.is_workshop_admin()))
  with check ((select public.is_workshop_admin()));

create or replace function public.create_inventory_import_product(
  p_draft_id uuid,
  p_item_kind text,
  p_code text,
  p_name text,
  p_brand text,
  p_condition text,
  p_category text,
  p_unit_cost numeric,
  p_suggested_price numeric
)
returns public.inventory_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_item public.inventory_catalog;
begin
  if (select auth.uid()) is null
    or not (select public.is_workshop_admin())
  then
    raise exception 'Solo un administrador puede revisar productos importados';
  end if;

  perform 1
  from public.inventory_import_drafts
  where id = p_draft_id and status = 'pending'
  for update;

  if not found then
    raise exception 'La fila ya fue revisada o no está disponible';
  end if;

  saved_item := public.create_inventory_catalog_item(
    p_item_kind, p_code, p_name, p_brand, p_condition, p_category,
    p_unit_cost, p_suggested_price
  );

  update public.inventory_import_drafts
  set status = 'reviewed',
      inventory_catalog_id = saved_item.id,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_draft_id;

  return saved_item;
end;
$$;

revoke all on function public.create_inventory_import_product(uuid, text, text, text, text, text, text, numeric, numeric)
  from public, anon;
grant execute on function public.create_inventory_import_product(uuid, text, text, text, text, text, text, numeric, numeric)
  to authenticated;

commit;
