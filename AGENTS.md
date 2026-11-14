# 🤖 GUÍA DE CONTEXTO Y NORMAS DEL AGENTE (RACING MACHINE SaaS)

## 1. Visión del Proyecto & Branding

- **Producto:** SaaS B2B para la gestión de talleres de motocicletas de alto cilindraje [KTM y multimarca](cite: 27).
- **Marca:** "RACING MACHINE - Servicio Técnico Especializado"[cite: 28].
- **Identidad:** Paleta en Naranja KTM (`var(--primary)` / OKLCH), Negro mate y Gris técnico[cite: 27, 28].

## 2. Stack Tecnológico (Estricto)

- **Frontend:** React 19 + TanStack Start (Router) + TypeScript + Vite[cite: 27].
- **Estilos:** Tailwind CSS v4 con configuración CSS pura en `src/styles.css` (`@import "tailwindcss"`, `@theme inline`, variables OKLCH).
- **Backend & DB:** Supabase (PostgreSQL, Auth RLS) + Drizzle ORM[cite: 27].
- **Despliegue Target:** Vercel[cite: 27].

## 3. Reglas Estrictas para el Estilo CSS (Tailwind v4)

- **REGLA DE ORO:** NUNCA sobrescribir ni reemplazar completamente el bloque CSS base de Tailwind v4 (`@theme inline`, `:root`, `.dark`).
- Conservar siempre los tokens originales en formato `oklch(...)`.
- Para ajustar contraste o jerarquía visual, modificar de manera quirúrgica las variables existentes (`--muted-foreground`, `--border`, `--input`) sin alterar la sintaxis de OKLCH.

## 4. UX / UI & Usabilidad en Taller (Multi-Dispositivo)

1. **Jerarquía Tipográfica y Contraste:**
   - Labels / Titulares de campos: Usar `text-muted-foreground` (`var(--muted-foreground)`).
   - Datos ingresados / Inputs: Usar `text-foreground` (`var(--foreground)`).
   - Destacados (Placa, ID Orden, Totales): Usar `text-primary` (`var(--primary)`) con `font-black`.
2. **Mobile & Tablet First (Mecánicos en Taller):**
   - Todos los inputs y botones interactivos deben tener una altura táctil mínima de `h-11` o `h-12` (44px - 48px).
   - Transformar tablas anchas en **Cards apiladas** en pantallas pequeñas (`<768px`).
   - Checkboxes de inspección (Rayones, Casco, Herramienta) deben ser botones táctiles tipo **Card/Badge** con estado activo visible.

## 5. Reglas de Código & Mantenibilidad

- Mantener arquitectura limpia: `src/components/` para UI, `src/routes/` para vistas, `src/lib/services/` para persistencia.
- Usar siempre alias de importación absoluta (`@/...`).
