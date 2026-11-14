-- Run after inventory_stock_setup.sql.
-- Imports selected workbook rows as inactive catalog entries without guessing
-- missing category, cost, suggested price, or physical stock.

begin;

alter table public.inventory_catalog
  add column if not exists fitment text;

alter table public.inventory_catalog
  drop constraint if exists inventory_catalog_condition_check;

alter table public.inventory_catalog
  add constraint inventory_catalog_condition_check
  check (condition in ('new_original', 'new_generic', 'repaired', 'aftermarket'));

alter table public.inventory_catalog
  drop constraint if exists inventory_catalog_kind_details_check;

alter table public.inventory_catalog
  add constraint inventory_catalog_kind_details_check check (
    (
      item_kind = 'part'
      and (
        not active
        or (
          nullif(btrim(brand), '') is not null
          and condition is not null
          and category is not null
        )
      )
    )
    or (
      item_kind = 'service'
      and condition is null
      and category is null
    )
  );

create or replace function public.bulk_review_inventory_drafts(
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_row public.inventory_import_drafts;
  saved_item public.inventory_catalog;
  item_data jsonb;
  item_id uuid;
  imported_count integer := 0;
begin
  if (select auth.uid()) is null
    or not (select public.is_workshop_admin())
  then
    raise exception 'Solo un administrador puede importar filas del inventario';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'Selecciona al menos una fila para importar';
  end if;

  if jsonb_array_length(p_items) > 500 then
    raise exception 'No se pueden importar más de 500 filas a la vez';
  end if;

  for item_data in
    select value from jsonb_array_elements(p_items)
  loop
    item_id := (item_data ->> 'id')::uuid;
    select d.* into draft_row
    from public.inventory_import_drafts d
    where d.id = item_id and d.status = 'pending'
    for update;

    if not found then
      continue;
    end if;

    begin
      insert into public.inventory_catalog(
        item_kind, code, name, brand, condition, category, fitment,
        suggested_price, price_original, price_generic, price_repaired,
        price_aftermarket, active, created_by
      )
      values (
        'part',
        case
          when item_data ? 'code' then nullif(btrim(item_data ->> 'code'), '')
          else nullif(btrim(draft_row.raw_code), '')
        end,
        coalesce(nullif(btrim(item_data ->> 'name'), ''), btrim(draft_row.raw_name)),
        case
          when item_data ? 'brand' then nullif(btrim(item_data ->> 'brand'), '')
          else nullif(btrim(draft_row.suggested_brand), '')
        end,
        case
          when item_data ? 'condition' then nullif(item_data ->> 'condition', '')
          else draft_row.suggested_condition
        end,
        nullif(item_data ->> 'category', ''),
        nullif(btrim(item_data ->> 'fitment'), ''),
        coalesce(nullif(item_data ->> 'suggested_price', '')::numeric, 0),
        coalesce(nullif(item_data ->> 'suggested_price', '')::numeric, 0),
        coalesce(nullif(item_data ->> 'suggested_price', '')::numeric, 0),
        coalesce(nullif(item_data ->> 'suggested_price', '')::numeric, 0),
        coalesce(nullif(item_data ->> 'suggested_price', '')::numeric, 0),
        false,
        (select auth.uid())
      )
      returning * into saved_item;

      insert into public.inventory_costs(catalog_id, unit_cost)
      values (
        saved_item.id,
        coalesce(nullif(item_data ->> 'unit_cost', '')::numeric, 0)
      );

      update public.inventory_import_drafts
      set status = 'reviewed',
          inventory_catalog_id = saved_item.id,
          reviewed_by = (select auth.uid()),
          reviewed_at = now()
      where id = draft_row.id;

      imported_count := imported_count + 1;
    exception
      when unique_violation then null;
    end;
  end loop;

  return imported_count;
end;
$$;

revoke all on function public.bulk_review_inventory_drafts(jsonb)
  from public, anon;
grant execute on function public.bulk_review_inventory_drafts(jsonb)
  to authenticated;

drop function if exists public.update_inventory_catalog_item(
  uuid, text, text, text, text, text, text, numeric, numeric, boolean
);

create or replace function public.update_inventory_catalog_item(
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

  if p_active and p_suggested_price <= 0 then
    raise exception 'El precio sugerido debe ser mayor que cero para activar el producto';
  end if;

  if p_active and (
    coalesce(p_price_original, p_suggested_price) <= 0
    or coalesce(p_price_generic, p_suggested_price) <= 0
    or coalesce(p_price_repaired, p_suggested_price) <= 0
    or coalesce(p_price_aftermarket, p_suggested_price) <= 0
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
      suggested_price = coalesce(p_price_original, p_suggested_price),
      price_original = coalesce(p_price_original, p_suggested_price),
      price_generic = coalesce(p_price_generic, p_suggested_price),
      price_repaired = coalesce(p_price_repaired, p_suggested_price),
      price_aftermarket = coalesce(p_price_aftermarket, p_suggested_price),
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

create or replace function public.create_inventory_catalog_item_with_fitment(
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

  if p_item_kind = 'part' and (
    coalesce(p_price_original, p_suggested_price) <= 0
    or coalesce(p_price_generic, p_suggested_price) <= 0
    or coalesce(p_price_repaired, p_suggested_price) <= 0
    or coalesce(p_price_aftermarket, p_suggested_price) <= 0
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

create or replace function public.set_inventory_stock_quantity(
  p_catalog_id uuid,
  p_quantity integer
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
    raise exception 'Inicia sesión para actualizar existencias';
  end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception 'La existencia debe ser un entero igual o mayor que cero';
  end if;

  if not exists (
    select 1
    from public.inventory_catalog
    where id = p_catalog_id and active and item_kind = 'part'
  ) then
    raise exception 'Solo se pueden actualizar existencias de repuestos activos';
  end if;

  insert into public.inventory_stock(catalog_id)
  values (p_catalog_id)
  on conflict (catalog_id) do nothing;

  select quantity_on_hand into current_quantity
  from public.inventory_stock
  where catalog_id = p_catalog_id
  for update;

  update public.inventory_stock
  set quantity_on_hand = p_quantity
  where catalog_id = p_catalog_id
  returning * into saved_stock;

  if current_quantity <> p_quantity then
    insert into public.inventory_stock_movements(
      catalog_id, recorded_by, direction, movement_type, quantity, note
    )
    values (
      p_catalog_id,
      (select auth.uid()),
      case when p_quantity > current_quantity then 'in' else 'out' end,
      'manual_adjustment',
      abs(p_quantity - current_quantity),
      'Conteo físico actualizado desde el inventario'
    );
  end if;

  return saved_stock;
end;
$$;

revoke all on function public.set_inventory_stock_quantity(uuid, integer)
  from public, anon;
grant execute on function public.set_inventory_stock_quantity(uuid, integer)
  to authenticated;

commit;
