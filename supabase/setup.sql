-- Initial schema for a new Racing Machine Supabase project.
-- Run this script once in the Supabase SQL Editor.

begin;

create sequence if not exists public.work_order_numbers start with 1;

create or replace function public.next_work_order_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.work_order_numbers');
  return lpad(next_number::text, greatest(4, length(next_number::text)), '0');
end;
$$;

revoke all on function public.next_work_order_number() from public, anon;
grant execute on function public.next_work_order_number() to authenticated;

create table if not exists public.work_orders (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number text not null default public.next_work_order_number(),
  data jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, number)
);

alter table public.work_orders enable row level security;
revoke all on table public.work_orders from public, anon, authenticated;
grant select, insert, update on table public.work_orders to authenticated;

drop policy if exists own_orders_read on public.work_orders;
create policy own_orders_read
  on public.work_orders for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists own_orders_insert on public.work_orders;
create policy own_orders_insert
  on public.work_orders for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists own_orders_update on public.work_orders;
create policy own_orders_update
  on public.work_orders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.order_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_number text not null,
  action text not null,
  details text[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (user_id, order_number)
    references public.work_orders(user_id, number) on delete cascade
);

create index if not exists order_history_lookup
  on public.order_history(user_id, order_number, created_at desc);

alter table public.order_history enable row level security;
revoke all on table public.order_history from public, anon, authenticated;
grant select on table public.order_history to authenticated;

drop policy if exists own_history_read on public.order_history;
create policy own_history_read
  on public.order_history for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.set_work_order_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.set_work_order_metadata() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.trace_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_fields text[] := '{}';
  field_name text;
  field_label text;
begin
  if tg_op = 'UPDATE' then
    foreach field_name in array array[
      'owner', 'bike', 'technician', 'report', 'inspection', 'accessories', 'items'
    ] loop
      if old.data -> field_name is distinct from new.data -> field_name then
        field_label := case field_name
          when 'owner' then 'Datos del cliente'
          when 'bike' then 'Datos de la motocicleta'
          when 'technician' then 'Técnico encargado'
          when 'report' then 'Reporte del cliente'
          when 'inspection' then 'Novedades de ingreso'
          when 'accessories' then 'Inventario al recibir'
          else 'Repuestos y servicios'
        end;
        changed_fields := array_append(changed_fields, field_label);
      end if;
    end loop;
  else
    changed_fields := array['Ingreso de la orden'];
  end if;

  insert into public.order_history(user_id, order_number, action, details)
  values (
    new.user_id,
    new.number,
    case when tg_op = 'INSERT' then 'Orden creada' else 'Orden actualizada' end,
    changed_fields
  );
  return new;
end;
$$;

revoke all on function public.trace_order_change() from public, anon, authenticated;

drop trigger if exists set_work_order_metadata on public.work_orders;
create trigger set_work_order_metadata
  before update on public.work_orders
  for each row execute function public.set_work_order_metadata();

drop trigger if exists trace_work_order on public.work_orders;
create trigger trace_work_order
  after insert or update on public.work_orders
  for each row execute function public.trace_order_change();

create or replace function public.save_work_order(
  p_data jsonb,
  p_number text default null,
  p_version integer default null
)
returns public.work_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_order public.work_orders;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para guardar';
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
      if p_version is distinct from saved_order.version then
        raise exception 'La orden cambió en otro dispositivo. Recarga antes de guardar.';
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

  return saved_order;
end;
$$;

revoke all on function public.save_work_order(jsonb, text, integer) from public, anon;
grant execute on function public.save_work_order(jsonb, text, integer) to authenticated;

create or replace function public.record_order_pdf(p_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.work_orders
      where user_id = (select auth.uid())
        and number = p_number
    )
  then
    raise exception 'Orden no disponible';
  end if;

  insert into public.order_history(user_id, order_number, action, details)
  values (
    (select auth.uid()),
    p_number,
    'PDF generado',
    array['Archivo preparado para descarga']
  );
end;
$$;

revoke all on function public.record_order_pdf(text) from public, anon;
grant execute on function public.record_order_pdf(text) to authenticated;

create or replace function public.is_workshop_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

revoke all on function public.is_workshop_admin() from public, anon;
grant execute on function public.is_workshop_admin() to authenticated;

create table if not exists public.order_catalog (
  id uuid primary key default gen_random_uuid(),
  catalog_type text not null check (catalog_type in ('inspection', 'accessory')),
  name text not null check (length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_catalog_type_name_unique
  on public.order_catalog(catalog_type, lower(name));
create index if not exists order_catalog_active_order
  on public.order_catalog(catalog_type, active, sort_order, name);

alter table public.order_catalog enable row level security;
revoke all on table public.order_catalog from public, anon, authenticated;
grant select, insert, update on table public.order_catalog to authenticated;

drop policy if exists active_order_catalog_read on public.order_catalog;
create policy active_order_catalog_read
  on public.order_catalog for select to authenticated
  using (active or (select public.is_workshop_admin()));

drop policy if exists admin_order_catalog_insert on public.order_catalog;
create policy admin_order_catalog_insert
  on public.order_catalog for insert to authenticated
  with check ((select public.is_workshop_admin()));

drop policy if exists admin_order_catalog_update on public.order_catalog;
create policy admin_order_catalog_update
  on public.order_catalog for update to authenticated
  using ((select public.is_workshop_admin()))
  with check ((select public.is_workshop_admin()));

drop trigger if exists set_order_catalog_updated_at on public.order_catalog;
create trigger set_order_catalog_updated_at
  before update on public.order_catalog
  for each row execute function public.set_updated_at();

insert into public.order_catalog(catalog_type, name, sort_order)
values
  ('inspection', 'Rayones / raspones', 10),
  ('inspection', 'Abolladura / deformación', 20),
  ('inspection', 'Fisura / rotura', 30),
  ('inspection', 'Pieza faltante', 40),
  ('inspection', 'Desgaste de pintura', 50),
  ('inspection', 'Corrosión / óxido', 60),
  ('inspection', 'Fuga de fluidos', 70),
  ('inspection', 'Daño eléctrico / luces', 80),
  ('inspection', 'Daño en asiento / tapicería', 90),
  ('inspection', 'Daño en neumáticos / ruedas', 100),
  ('inspection', 'Daño en manillar / mandos', 110),
  ('inspection', 'Testigo encendido en tablero', 120),
  ('accessory', 'Llaves', 10),
  ('accessory', 'Casco', 20),
  ('accessory', 'Herramienta', 30),
  ('accessory', 'Tarjeta de propiedad', 40),
  ('accessory', 'SOAT', 50),
  ('accessory', 'Espejos', 60),
  ('accessory', 'Maletero / baúl', 70),
  ('accessory', 'Maletas laterales', 80),
  ('accessory', 'Protector de motor', 90),
  ('accessory', 'Cargador / toma auxiliar', 100),
  ('accessory', 'Otro accesorio', 110)
on conflict (catalog_type, (lower(name))) do nothing;

create table if not exists public.inventory_catalog (
  id uuid primary key default gen_random_uuid(),
  item_kind text not null check (item_kind in ('part', 'service')),
  code text,
  name text not null check (length(btrim(name)) between 1 and 160),
  brand text,
  condition text check (condition in ('new_original', 'new_generic', 'repaired', 'aftermarket')),
  category text check (category in ('mechanical', 'electrical', 'luxury')),
  suggested_price numeric(12, 2) not null default 0 check (suggested_price >= 0),
  price_original numeric(12, 2) not null default 0 check (price_original >= 0),
  price_generic numeric(12, 2) not null default 0 check (price_generic >= 0),
  price_repaired numeric(12, 2) not null default 0 check (price_repaired >= 0),
  price_aftermarket numeric(12, 2) not null default 0 check (price_aftermarket >= 0),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_catalog_kind_details_check check (
    (item_kind = 'part'
      and nullif(btrim(brand), '') is not null
      and condition is not null
      and category is not null)
    or
    (item_kind = 'service'
      and condition is null
      and category is null)
  )
);

create unique index if not exists inventory_catalog_code_unique
  on public.inventory_catalog(lower(code))
  where code is not null and length(btrim(code)) > 0;
create index if not exists inventory_catalog_search
  on public.inventory_catalog(active, item_kind, lower(name), lower(coalesce(brand, '')));

alter table public.inventory_catalog enable row level security;
revoke all on table public.inventory_catalog from public, anon, authenticated;
grant select, insert, update on table public.inventory_catalog to authenticated;

drop policy if exists active_inventory_catalog_read on public.inventory_catalog;
create policy active_inventory_catalog_read
  on public.inventory_catalog for select to authenticated
  using (active or (select public.is_workshop_admin()));

drop policy if exists admin_inventory_catalog_insert on public.inventory_catalog;
create policy admin_inventory_catalog_insert
  on public.inventory_catalog for insert to authenticated
  with check ((select public.is_workshop_admin()));

drop policy if exists admin_inventory_catalog_update on public.inventory_catalog;
create policy admin_inventory_catalog_update
  on public.inventory_catalog for update to authenticated
  using ((select public.is_workshop_admin()))
  with check ((select public.is_workshop_admin()));

drop trigger if exists set_inventory_catalog_updated_at on public.inventory_catalog;
create trigger set_inventory_catalog_updated_at
  before update on public.inventory_catalog
  for each row execute function public.set_updated_at();

create table if not exists public.order_audio_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_number text not null,
  storage_path text not null unique,
  transcript text not null default '',
  mime_type text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  consent_given boolean not null check (consent_given),
  consented_by uuid not null default auth.uid() references auth.users(id),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (user_id, order_number)
    references public.work_orders(user_id, number) on delete cascade,
  constraint order_audio_path_owner_check check (
    storage_path like user_id::text || '/' || order_number || '/%'
  )
);

create index if not exists order_audio_order_lookup
  on public.order_audio_recordings(user_id, order_number, created_at desc);

alter table public.order_audio_recordings enable row level security;
revoke all on table public.order_audio_recordings from public, anon, authenticated;
grant select, insert, delete on table public.order_audio_recordings to authenticated;
grant update (transcript) on table public.order_audio_recordings to authenticated;

drop policy if exists own_order_audio_read on public.order_audio_recordings;
create policy own_order_audio_read
  on public.order_audio_recordings for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists own_order_audio_insert on public.order_audio_recordings;
create policy own_order_audio_insert
  on public.order_audio_recordings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and consented_by = (select auth.uid())
    and consent_given
  );

drop policy if exists own_order_audio_update on public.order_audio_recordings;
create policy own_order_audio_update
  on public.order_audio_recordings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists own_order_audio_delete on public.order_audio_recordings;
create policy own_order_audio_delete
  on public.order_audio_recordings for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-audio',
  'order-audio',
  false,
  20971520,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists own_order_audio_objects_read on storage.objects;
create policy own_order_audio_objects_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'order-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.work_orders
      where user_id = (select auth.uid())
        and number = (storage.foldername(name))[2]
    )
  );

drop policy if exists own_order_audio_objects_insert on storage.objects;
create policy own_order_audio_objects_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'order-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.work_orders
      where user_id = (select auth.uid())
        and number = (storage.foldername(name))[2]
    )
  );

drop policy if exists own_order_audio_objects_delete on storage.objects;
create policy own_order_audio_objects_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'order-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.work_orders
      where user_id = (select auth.uid())
        and number = (storage.foldername(name))[2]
    )
  );

commit;
