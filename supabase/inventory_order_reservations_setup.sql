-- Run after setup.sql, inventory_stock_setup.sql, inventory_bulk_review_setup.sql,
-- and inventory_condition_prices_setup.sql in the Supabase SQL Editor.
-- Reservations are global across users because inventory is shared by the workshop.
begin;

create table if not exists public.inventory_order_reservations (
  user_id uuid not null,
  order_number text not null,
  catalog_id uuid not null references public.inventory_catalog(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null check (status in ('reserved', 'released', 'consumed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, order_number, catalog_id),
  foreign key (user_id, order_number)
    references public.work_orders(user_id, number) on delete cascade
);

create index if not exists inventory_order_reservations_available
  on public.inventory_order_reservations(catalog_id, status)
  where status = 'reserved';

alter table public.inventory_order_reservations enable row level security;
revoke all on table public.inventory_order_reservations from public, anon, authenticated;

insert into public.inventory_order_reservations(
  user_id, order_number, catalog_id, quantity, status
)
select
  work_order.user_id,
  work_order.number,
  catalog.id,
  sum((item.value ->> 'qty')::integer)::integer,
  'reserved'
from public.work_orders work_order
cross join lateral jsonb_array_elements(
  coalesce(work_order.data -> 'items', '[]'::jsonb)
) as item(value)
join public.inventory_catalog catalog
  on catalog.id = case
    when coalesce(item.value ->> 'catalogId', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (item.value ->> 'catalogId')::uuid
    else null::uuid
  end
  and catalog.item_kind = 'part'
where coalesce(work_order.data ->> 'status', '')
  not in ('entregada', 'finalizada', 'cancelada')
  and coalesce(item.value ->> 'qty', '') ~ '^[1-9][0-9]*$'
group by work_order.user_id, work_order.number, catalog.id
on conflict (user_id, order_number, catalog_id)
do update set
  quantity = excluded.quantity,
  status = 'reserved',
  updated_at = now();

create or replace function public.get_inventory_stock_availability(
  p_catalog_ids uuid[],
  p_exclude_order_number text default null
)
returns table (
  catalog_id uuid,
  quantity_on_hand integer,
  quantity_reserved integer,
  quantity_available integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  excluded_order_number text;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para consultar el inventario';
  end if;

  if p_exclude_order_number is not null and exists (
    select 1
    from public.work_orders
    where user_id = (select auth.uid())
      and number = p_exclude_order_number
  ) then
    excluded_order_number := p_exclude_order_number;
  end if;

  return query
  select
    requested.catalog_id,
    coalesce(stock.quantity_on_hand, 0)::integer,
    coalesce(reserved.quantity_reserved, 0)::integer,
    greatest(
      coalesce(stock.quantity_on_hand, 0)
        - coalesce(reserved.quantity_reserved, 0),
      0
    )::integer
  from (
    select distinct unnest(coalesce(p_catalog_ids, array[]::uuid[])) as catalog_id
  ) requested
  left join public.inventory_stock stock
    on stock.catalog_id = requested.catalog_id
  left join lateral (
    select sum(reservation.quantity)::integer as quantity_reserved
    from public.inventory_order_reservations reservation
    where reservation.catalog_id = requested.catalog_id
      and reservation.status = 'reserved'
      and (
        excluded_order_number is null
        or reservation.user_id <> (select auth.uid())
        or reservation.order_number <> excluded_order_number
      )
  ) reserved on true;
end;
$$;

revoke all on function public.get_inventory_stock_availability(uuid[], text)
  from public, anon;
grant execute on function public.get_inventory_stock_availability(uuid[], text)
  to authenticated;

create or replace function public.save_work_order(
  p_data jsonb,
  p_number text default null,
  p_version integer default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_order public.work_orders;
  previous_status text;
  desired_status text;
  affected_catalog_ids uuid[];
  item_row record;
  physical_quantity integer;
  reserved_quantity integer;
  available_quantity integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para guardar';
  end if;

  desired_status := p_data ->> 'status';
  if desired_status not in (
    'diagnostico', 'reparacion', 'lista', 'entregada', 'finalizada', 'cancelada'
  ) or desired_status is null then
    raise exception 'El estado de la orden no es válido';
  end if;
  if jsonb_typeof(coalesce(p_data -> 'items', '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de repuestos de la orden no es válida';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
      as expanded(item)
    where coalesce(item ->> 'qty', '') !~ '^([1-9][0-9]{0,2}|1000)$'
  ) then
    raise exception 'Las cantidades de repuestos y servicios deben ser enteros entre 1 y 1000';
  end if;

  if p_number is null then
    insert into public.work_orders(data)
    values (p_data)
    returning * into saved_order;
  else
    select *
    into saved_order
    from public.work_orders
    where user_id = (select auth.uid())
      and number = p_number
    for update;

    if found then
      previous_status := saved_order.data ->> 'status';
      if p_version is distinct from saved_order.version then
        raise exception 'La orden cambió en otro dispositivo. Recarga antes de guardar.';
      end if;
      if previous_status in ('entregada', 'finalizada', 'cancelada')
        and desired_status <> previous_status
      then
        raise exception 'No se puede cambiar el estado de una orden cerrada.';
      end if;
      if previous_status in ('entregada', 'finalizada', 'cancelada')
        and (p_data -> 'items') is distinct from (saved_order.data -> 'items')
      then
        raise exception 'No se pueden cambiar los repuestos de una orden cerrada.';
      end if;

      update public.work_orders
      set data = p_data
      where user_id = (select auth.uid())
        and number = p_number
      returning * into saved_order;
    else
      insert into public.work_orders(number, data)
      values (p_number, p_data)
      returning * into saved_order;
    end if;
  end if;

  select array_agg(distinct id)
  into affected_catalog_ids
  from (
    select catalog.id
    from jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
      as expanded(item)
    join public.inventory_catalog catalog
      on catalog.id = case
        when coalesce(item ->> 'catalogId', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (item ->> 'catalogId')::uuid
        else null::uuid
      end
      and catalog.item_kind = 'part'

    union

    select reservation.catalog_id
    from public.inventory_order_reservations reservation
    where reservation.user_id = (select auth.uid())
      and reservation.order_number = saved_order.number
      and reservation.status = 'reserved'
  ) ids;

  if affected_catalog_ids is not null then
    insert into public.inventory_stock(catalog_id)
    select unnest(affected_catalog_ids)
    on conflict (catalog_id) do nothing;

    perform stock.catalog_id
    from public.inventory_stock stock
    where stock.catalog_id = any(affected_catalog_ids)
    order by stock.catalog_id
    for update;
  end if;

  if desired_status in ('diagnostico', 'reparacion', 'lista') then
    for item_row in
      select catalog.id as catalog_id, sum((item ->> 'qty')::integer)::integer as quantity
      from jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
        as expanded(item)
      join public.inventory_catalog catalog
        on catalog.id = case
          when coalesce(item ->> 'catalogId', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (item ->> 'catalogId')::uuid
          else null::uuid
        end
        and catalog.item_kind = 'part'
      group by catalog.id
      order by catalog.id
    loop
      select stock.quantity_on_hand
      into physical_quantity
      from public.inventory_stock stock
      where stock.catalog_id = item_row.catalog_id;

      select coalesce(sum(reservation.quantity), 0)::integer
      into reserved_quantity
      from public.inventory_order_reservations reservation
      where reservation.catalog_id = item_row.catalog_id
        and reservation.status = 'reserved'
        and not (
          reservation.user_id = (select auth.uid())
          and reservation.order_number = saved_order.number
        );

      available_quantity := physical_quantity - reserved_quantity;
      if item_row.quantity > available_quantity then
        raise exception 'Pieza reservada temporalmente en otra orden de trabajo activa (% disponibles)',
          greatest(available_quantity, 0);
      end if;
    end loop;

    update public.inventory_order_reservations
    set status = 'released', updated_at = now()
    where user_id = (select auth.uid())
      and order_number = saved_order.number
      and status = 'reserved';

    insert into public.inventory_order_reservations(
      user_id, order_number, catalog_id, quantity, status
    )
    select
      (select auth.uid()),
      saved_order.number,
      catalog.id,
      sum((item ->> 'qty')::integer)::integer,
      'reserved'
    from jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
      as expanded(item)
    join public.inventory_catalog catalog
      on catalog.id = case
        when coalesce(item ->> 'catalogId', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (item ->> 'catalogId')::uuid
        else null::uuid
      end
      and catalog.item_kind = 'part'
    group by catalog.id
    on conflict (user_id, order_number, catalog_id)
    do update set
      quantity = excluded.quantity,
      status = 'reserved',
      updated_at = now();

  elsif desired_status = 'cancelada' then
    update public.inventory_order_reservations
    set status = 'released', updated_at = now()
    where user_id = (select auth.uid())
      and order_number = saved_order.number
      and status = 'reserved';

  elsif coalesce(previous_status, '') not in ('entregada', 'finalizada') then
    for item_row in
      select catalog.id as catalog_id, sum((item ->> 'qty')::integer)::integer as quantity
      from jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
        as expanded(item)
      join public.inventory_catalog catalog
        on catalog.id = case
          when coalesce(item ->> 'catalogId', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (item ->> 'catalogId')::uuid
          else null::uuid
        end
        and catalog.item_kind = 'part'
      group by catalog.id
      order by catalog.id
    loop
      select stock.quantity_on_hand
      into physical_quantity
      from public.inventory_stock stock
      where stock.catalog_id = item_row.catalog_id;

      select coalesce(sum(reservation.quantity), 0)::integer
      into reserved_quantity
      from public.inventory_order_reservations reservation
      where reservation.catalog_id = item_row.catalog_id
        and reservation.status = 'reserved'
        and not (
          reservation.user_id = (select auth.uid())
          and reservation.order_number = saved_order.number
        );

      available_quantity := physical_quantity - reserved_quantity;
      if item_row.quantity > available_quantity then
        raise exception 'No hay stock suficiente para finalizar la orden (% disponibles)',
          greatest(available_quantity, 0);
      end if;

      update public.inventory_stock
      set quantity_on_hand = quantity_on_hand - item_row.quantity,
          updated_at = now()
      where catalog_id = item_row.catalog_id;

      insert into public.inventory_stock_movements(
        catalog_id, recorded_by, direction, movement_type, quantity, note
      )
      values (
        item_row.catalog_id,
        (select auth.uid()),
        'out',
        'consumption',
        item_row.quantity,
        'Consumo al cerrar orden #' || saved_order.number
      );
    end loop;

    update public.inventory_order_reservations
    set status = 'released', updated_at = now()
    where user_id = (select auth.uid())
      and order_number = saved_order.number
      and status = 'reserved';

    insert into public.inventory_order_reservations(
      user_id, order_number, catalog_id, quantity, status
    )
    select
      (select auth.uid()),
      saved_order.number,
      catalog.id,
      sum((item ->> 'qty')::integer)::integer,
      'consumed'
    from jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
      as expanded(item)
    join public.inventory_catalog catalog
      on catalog.id = case
        when coalesce(item ->> 'catalogId', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (item ->> 'catalogId')::uuid
        else null::uuid
      end
      and catalog.item_kind = 'part'
    group by catalog.id
    on conflict (user_id, order_number, catalog_id)
    do update set
      quantity = excluded.quantity,
      status = 'consumed',
      updated_at = now();
  end if;

  return saved_order;
end;
$$;

revoke all on function public.save_work_order(jsonb, text, integer)
  from public, anon;
revoke insert, update on table public.work_orders from authenticated;
grant select on table public.work_orders to authenticated;
grant execute on function public.save_work_order(jsonb, text, integer)
  to authenticated;

create or replace function public.set_work_order_status(
  p_number text,
  p_status text
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_order public.work_orders;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para cambiar el estado de la orden';
  end if;

  if p_status is null or p_status not in (
    'diagnostico', 'reparacion', 'lista', 'entregada', 'finalizada', 'cancelada'
  ) then
    raise exception 'El estado de la orden no es válido';
  end if;

  select *
  into existing_order
  from public.work_orders
  where user_id = (select auth.uid())
    and number = p_number
  for update;

  if not found then
    raise exception 'No se encontró la orden solicitada';
  end if;

  return public.save_work_order(
    existing_order.data || jsonb_build_object('status', p_status),
    existing_order.number,
    existing_order.version
  );
end;
$$;

revoke all on function public.set_work_order_status(text, text)
  from public, anon;
grant execute on function public.set_work_order_status(text, text)
  to authenticated;

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
  reserved_quantity integer;
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
    or p_movement_type not in (
      'opening', 'purchase', 'manual_adjustment', 'consumption', 'return', 'other'
    )
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
  select stock.quantity_on_hand
  into current_quantity
  from public.inventory_stock stock
  where stock.catalog_id = p_catalog_id
  for update;
  select coalesce(sum(reservation.quantity), 0)::integer
  into reserved_quantity
  from public.inventory_order_reservations reservation
  where reservation.catalog_id = p_catalog_id
    and reservation.status = 'reserved';

  if p_direction = 'out'
    and p_quantity > current_quantity - reserved_quantity
  then
    raise exception 'La salida supera el stock disponible después de las reservas';
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
    p_catalog_id, (select auth.uid()), p_direction, p_movement_type, p_quantity,
    coalesce(p_note, '')
  );
  return saved_stock;
end;
$$;

revoke all on function public.record_inventory_movement(uuid, text, text, integer, text)
  from public, anon;
grant execute on function public.record_inventory_movement(uuid, text, text, integer, text)
  to authenticated;

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
  reserved_quantity integer;
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
  select stock.quantity_on_hand
  into current_quantity
  from public.inventory_stock stock
  where stock.catalog_id = p_catalog_id
  for update;
  select coalesce(sum(reservation.quantity), 0)::integer
  into reserved_quantity
  from public.inventory_order_reservations reservation
  where reservation.catalog_id = p_catalog_id
    and reservation.status = 'reserved';

  if p_quantity < reserved_quantity then
    raise exception 'La existencia no puede ser menor que las unidades reservadas (%)',
      reserved_quantity;
  end if;

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
