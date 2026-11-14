# 🏗️ ARQUITECTURA REAL DE BASE DE DATOS (SUPABASE)

## 1. Órdenes de Trabajo (`public.work_orders`)

- `user_id`: UUID (PK, FK -> auth.users)
- `number`: TEXT (PK, autogenerado por secuencia `next_work_order_number()`)
- `data`: JSONB (Contiene: owner, bike, technician, report, inspection, accessories, items)
- `version`: INT (Control de concurrencia)
- `updated_at`: TIMESTAMPTZ

## 2. Catálogo de Inventario (`public.inventory_catalog`)

- `id`: UUID (PK)
- `item_kind`: TEXT ('part' | 'service')
- `code`: TEXT (Código de pieza / OEM)
- `name`: TEXT (Nombre del repuesto o servicio)
- `brand`: TEXT (Marca ej: Bajaj, KTM)
- `condition`: TEXT ('new_original' | 'new_generic' | 'repaired')
- `category`: TEXT ('mechanical' | 'electrical' | 'luxury')
- `fitment`: TEXT (Motos compatibles)
- `suggested_price`: NUMERIC(12, 2)
- `active`: BOOLEAN

## 3. Costos y Stock (`public.inventory_costs` & `public.inventory_stock`)

- `catalog_id`: UUID (PK, FK -> inventory_catalog.id)
- `unit_cost`: NUMERIC(12, 2) (Costo interno accesible solo por Admin)
- `quantity_on_hand`: INT (Cantidad disponible en stock)
