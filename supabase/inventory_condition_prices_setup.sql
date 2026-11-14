-- Run after inventory_bulk_review_setup.sql to enable condition-specific
-- customer prices for new and existing inventory catalog items.

begin;

alter table public.inventory_catalog
  add column if not exists price_original numeric(12, 2) not null default 0
    check (price_original >= 0),
  add column if not exists price_generic numeric(12, 2) not null default 0
    check (price_generic >= 0),
  add column if not exists price_repaired numeric(12, 2) not null default 0
    check (price_repaired >= 0),
  add column if not exists price_aftermarket numeric(12, 2) not null default 0
    check (price_aftermarket >= 0);

update public.inventory_catalog
set price_original = suggested_price,
    price_generic = suggested_price,
    price_repaired = suggested_price,
    price_aftermarket = suggested_price
where suggested_price > 0
  and price_original = 0
  and price_generic = 0
  and price_repaired = 0
  and price_aftermarket = 0;

alter table public.inventory_catalog
  drop constraint if exists inventory_catalog_condition_check;
alter table public.inventory_catalog
  add constraint inventory_catalog_condition_check
  check (condition in ('new_original', 'new_generic', 'repaired', 'aftermarket'));

alter table public.inventory_import_drafts
  drop constraint if exists inventory_import_drafts_suggested_condition_check;
alter table public.inventory_import_drafts
  add constraint inventory_import_drafts_suggested_condition_check
  check (suggested_condition in ('new_original', 'new_generic', 'repaired', 'aftermarket'));

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
    p_item_kind,
    nullif(btrim(p_code), ''),
    btrim(p_name),
    nullif(btrim(p_brand), ''),
    nullif(p_condition, ''),
    nullif(p_category, ''),
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
  text, text, text, text, text, text, numeric, numeric,
  numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.create_inventory_catalog_item(
  text, text, text, text, text, text, numeric, numeric,
  numeric, numeric, numeric, numeric
) to authenticated;

drop function if exists public.update_inventory_catalog_item(
  uuid, text, text, text, text, text, text, numeric, numeric, boolean
);
create function public.update_inventory_catalog_item(
  p_catalog_id uuid,
  p_code text,
  p_name text,
  p_brand text,
  p_condition text,
  p_category text,
  p_fitment text,
  p_unit_cost numeric,
  p_suggested_price numeric,
  p_active boolean,
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
  original_price numeric;
  generic_price numeric;
  repaired_price numeric;
  aftermarket_price numeric;
begin
  if (select auth.uid()) is null
    or not (select public.is_workshop_admin())
  then
    raise exception 'Solo un administrador puede editar el catálogo';
  end if;

  if p_name is null or length(btrim(p_name)) not between 1 and 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres';
  end if;

  if p_unit_cost is null or p_unit_cost < 0
    or p_suggested_price is null or p_suggested_price < 0
  then
    raise exception 'El costo y el precio sugerido deben ser cero o mayores';
  end if;

  original_price := coalesce(p_price_original, p_suggested_price);
  generic_price := coalesce(p_price_generic, p_suggested_price);
  repaired_price := coalesce(p_price_repaired, p_suggested_price);
  aftermarket_price := coalesce(p_price_aftermarket, p_suggested_price);

  if least(original_price, generic_price, repaired_price, aftermarket_price) < 0 then
    raise exception 'Los precios por condición no pueden ser negativos';
  end if;
  if p_active and p_suggested_price <= 0 then
    raise exception 'El precio sugerido debe ser mayor que cero para activar el producto';
  end if;
  if p_active and (
    original_price <= 0
    or generic_price <= 0
    or repaired_price <= 0
    or aftermarket_price <= 0
  ) then
    raise exception 'Configura un precio mayor que cero para cada condición';
  end if;

  update public.inventory_catalog
  set code = nullif(btrim(p_code), ''),
      name = btrim(p_name),
      brand = nullif(btrim(p_brand), ''),
      condition = nullif(p_condition, ''),
      category = nullif(p_category, ''),
      fitment = nullif(btrim(p_fitment), ''),
      suggested_price = original_price,
      price_original = original_price,
      price_generic = generic_price,
      price_repaired = repaired_price,
      price_aftermarket = aftermarket_price,
      active = p_active
  where id = p_catalog_id
  returning * into saved_item;

  if not found then
    raise exception 'El producto no existe o ya fue eliminado';
  end if;

  insert into public.inventory_costs(catalog_id, unit_cost)
  values (p_catalog_id, p_unit_cost)
  on conflict (catalog_id) do update
    set unit_cost = excluded.unit_cost,
        updated_at = now();

  return saved_item;
end;
$$;

revoke all on function public.update_inventory_catalog_item(
  uuid, text, text, text, text, text, text, numeric, numeric, boolean,
  numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.update_inventory_catalog_item(
  uuid, text, text, text, text, text, text, numeric, numeric, boolean,
  numeric, numeric, numeric, numeric
) to authenticated;

drop function if exists public.create_inventory_catalog_item_with_fitment(
  uuid, text, text, text, text, text, text, text, numeric, numeric
);
create function public.create_inventory_catalog_item_with_fitment(
  p_draft_id uuid,
  p_item_kind text,
  p_code text,
  p_name text,
  p_brand text,
  p_condition text,
  p_category text,
  p_fitment text,
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
  original_price numeric;
  generic_price numeric;
  repaired_price numeric;
  aftermarket_price numeric;
begin
  if (select auth.uid()) is null
    or not (select public.is_workshop_admin())
  then
    raise exception 'Solo un administrador puede crear productos';
  end if;

  if p_unit_cost is null or p_unit_cost < 0
    or p_suggested_price is null or p_suggested_price <= 0
  then
    raise exception 'El costo no puede ser negativo y el precio sugerido debe ser mayor que cero';
  end if;

  original_price := coalesce(p_price_original, p_suggested_price);
  generic_price := coalesce(p_price_generic, p_suggested_price);
  repaired_price := coalesce(p_price_repaired, p_suggested_price);
  aftermarket_price := coalesce(p_price_aftermarket, p_suggested_price);

  if least(original_price, generic_price, repaired_price, aftermarket_price) < 0 then
    raise exception 'Los precios por condición no pueden ser negativos';
  end if;
  if p_item_kind = 'part' and (
    original_price <= 0
    or generic_price <= 0
    or repaired_price <= 0
    or aftermarket_price <= 0
  ) then
    raise exception 'Configura un precio mayor que cero para cada condición';
  end if;

  if p_draft_id is not null then
    perform 1
    from public.inventory_import_drafts
    where id = p_draft_id and status = 'pending'
    for update;

    if not found then
      raise exception 'La fila ya fue revisada o no está disponible';
    end if;
  end if;

  insert into public.inventory_catalog(
    item_kind, code, name, brand, condition, category, fitment,
    suggested_price, price_original, price_generic, price_repaired,
    price_aftermarket, created_by
  )
  values (
    p_item_kind,
    nullif(btrim(p_code), ''),
    btrim(p_name),
    nullif(btrim(p_brand), ''),
    nullif(p_condition, ''),
    nullif(p_category, ''),
    nullif(btrim(p_fitment), ''),
    case when p_item_kind = 'part' then original_price else p_suggested_price end,
    original_price,
    generic_price,
    repaired_price,
    aftermarket_price,
    (select auth.uid())
  )
  returning * into saved_item;

  insert into public.inventory_costs(catalog_id, unit_cost)
  values (saved_item.id, p_unit_cost);

  if p_draft_id is not null then
    update public.inventory_import_drafts
    set status = 'reviewed',
        inventory_catalog_id = saved_item.id,
        reviewed_by = (select auth.uid()),
        reviewed_at = now()
    where id = p_draft_id;
  end if;

  return saved_item;
end;
$$;

revoke all on function public.create_inventory_catalog_item_with_fitment(
  uuid, text, text, text, text, text, text, text, numeric, numeric,
  numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.create_inventory_catalog_item_with_fitment(
  uuid, text, text, text, text, text, text, text, numeric, numeric,
  numeric, numeric, numeric, numeric
) to authenticated;

commit;
