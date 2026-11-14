# 🔌 ESPECIFICACIÓN DE APIS Y SERVER FUNCTIONS (RACING MACHINE SaaS)

## 1. Visión General de Integración

Este documento define los contratos de datos, Server Functions (TanStack Start) y servicios de Supabase para el consumo de la aplicación web y dispositivos móviles en el taller.

---

## 2. Server Functions: Módulo de Órdenes de Trabajo (`src/lib/services/orders.service.ts`)

### 2.1. Listar Órdenes de Trabajo

- **Función:** `getWorkOrders`
- **Tipo:** Server Function (`createServerFn`)
- **Descripción:** Obtiene la lista filtrada de órdenes de trabajo con paginación y búsqueda por término (placa, cliente o número de orden).

**Parámetros de Entrada (Query Schema - Zod):**

```typescript
import { z } from 'zod'

export const getWorkOrdersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'DIAGNOSIS', 'REPAIR', 'READY', 'DELIVERED']).default('ALL'),
  page: z.number().default(1),
  limit: z.number().default(10)
})
```

**Respuesta Exitosa (JSON):**

```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "order_number": 980,
      "entry_date": "2026-09-02",
      "customer": {
        "full_name": "Javier Andr茅s Gonz谩lez Pacateque",
        "document_id": "1121837363"
      },
      "motorcycle": {
        "plate": "LUM08G",
        "model_reference": "KTM Duke 390 NG"
      },
      "assigned_tech_name": "Jordan Galindo (Jefe de Taller)",
      "status": "DIAGNOSIS",
      "total_amount": 15339000.00
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "total_pages": 1
  }
}
```

---

### 2.2. Crear Nueva Orden de Trabajo (Wizard Complete)

- **Funci贸n:** `createWorkOrder`
- **Tipo:** Server Function (`createServerFn`)
- **Descripci贸n:** Registra la informaci贸n completa del cliente, motocicleta, reporte inicial, checklist de novedades/inventario y los 铆tems cotizados.

**Par谩metros de Entrada (Body Schema - Zod):**

```typescript
export const createWorkOrderSchema = z.object({
  workshop_id: z.string().uuid(),
  customer: z.object({
    document_type: z.enum(['CC', 'NIT', 'CE']),
    document_id: z.string().min(5),
    full_name: z.string().min(3),
    phone: z.string().min(7),
    email: z.string().email().optional()
  }),
  motorcycle: z.object({
    plate: z.string().min(6).max(10),
    brand: z.string().default('KTM'),
    model_reference: z.string().min(2),
    mileage: z.number().positive(),
    vin_chassis: z.string().optional(),
    engine_number: z.string().optional()
  }),
  order: z.object({
    assigned_tech_name: z.string().min(2),
    initial_diagnosis: z.string().min(10),
    visual_inspection: z.object({
      rayones: z.boolean().default(false),
      hundido: z.boolean().default(false),
      falta: z.boolean().default(false),
      manchado: z.boolean().default(false),
      oxidado: z.boolean().default(false),
      fracturados: z.boolean().default(false)
    }),
    inventory_checklist: z.object({
      herramienta: z.boolean().default(false),
      casco: z.boolean().default(false),
      llaves: z.boolean().default(false),
      chaleco: z.boolean().default(false),
      matricula: z.boolean().default(false),
      soat: z.boolean().default(false),
      retro_izq: z.boolean().default(false),
      retro_der: z.boolean().default(false)
    })
  }),
  items: z.array(
    z.object({
      description: z.string().min(2),
      type: z.enum(['NEW_ORIGINAL', 'AFTERMARKET', 'REPAIRED', 'LABOR']),
      unit_price: z.number().positive(),
      quantity: z.number().int().positive().default(1)
    })
  )
})
```

**Respuesta Exitosa (JSON):**

```json
{
  "success": true,
  "message": "Orden de trabajo #0981 creada exitosamente.",
  "work_order_id": "b38ac10b-58cc-4372-a567-0e02b2c3d981",
  "order_number": 981
}
```

---

## 3. Server Functions: M贸dulo de Inventario & Repuestos (`src/lib/services/inventory.service.ts`)

### 3.1. Obtener Cat谩logo y Existencias

- **Funci贸n:** `getInventoryItems`
- **Descripci贸n:** Retorna repuestos e insumos filtrados por marca, categor铆a o compatibilidad de modelo.

**Query Schema (Zod):**

```typescript
export const getInventorySchema = z.object({
  search: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional()
})
```

**Respuesta Exitosa (JSON):**

```json
{
  "data": [
    {
      "id": "e12ac10b-58cc-4372-a567-0e02b2c3d111",
      "name": "Sudchasis con soportes",
      "code": "KTM-5481",
      "brand": "KTM",
      "condition": "NUEVO ORIGINAL",
      "category": "Estructura / Chasis",
      "suggested_price": 1800000.00,
      "stock": 3
    }
  ]
}
```

---

## 4. Respuestas de Error Est谩ndar (HTTP/ServerFn)

Todas las respuestas con falla mantendr谩n la siguiente estructura normalizada:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR | DATABASE_ERROR | NOT_FOUND",
  "message": "Descripci贸n amigable del error para notificar con Sonner/Toast.",
  "details": []
}
```
