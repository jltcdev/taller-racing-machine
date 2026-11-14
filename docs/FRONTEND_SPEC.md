# 🎨 Guía enterprise de frontend y componentes — Racing Machine

Este documento define los criterios de implementación y revisión visual para las
pantallas de Inventario, Órdenes, Dashboard y Configuración. Su objetivo es
mantener una interfaz consistente, accesible y práctica para el trabajo diario
en taller.

## 1. Tokens de estilos y CSS — Tailwind CSS v4

- Usa Tailwind CSS v4 con la hoja global [`src/styles.css`](../src/styles.css):
  `@import "tailwindcss"` y tokens en `@theme inline`.
- Define los colores del sistema como variables CSS en formato `oklch(...)`,
  con valores para el tema claro (`:root`) y oscuro (`.dark`). Evita colores
  fijos en componentes cuando exista un token semántico equivalente.
- Usa las clases semánticas derivadas de los tokens:
  - **Marca / acción principal:** `bg-primary`, `text-primary` y
    `text-primary-foreground`. El naranja Racing se reserva para énfasis y
    acciones principales.
  - **Valores y texto principal:** `text-foreground`.
  - **Etiquetas y texto secundario:** `text-muted-foreground`.
  - **Superficies:** `bg-background`, `bg-card` y `bg-muted`.
  - **Bordes y separadores:** `border-border`.
- Mantén contraste de texto de al menos 4.5:1 para texto normal y 3:1 para
  texto grande, de acuerdo con WCAG AA. Los bordes y separadores deben
  distinguir los controles y las superficies sin depender solo del color.
- No introduzcas valores hexadecimales, `rgb()` ni colores arbitrarios si se
  puede usar un token del tema. Si hace falta un color nuevo, define su token
  para ambos temas y regístralo en `@theme inline`.

## 2. Scrollbars y layouts

### Scrollbars globales

La hoja `src/styles.css` define scrollbars delgados para los contenedores
desplazables, con pista transparente y un pulgar redondeado en un tono tenue.
Conserva soporte para Firefox y WebKit, y usa los tokens existentes en vez de
añadir estilos locales en tablas o pantallas.

```css
/* Referencia conceptual; mantener la implementación global en src/styles.css. */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background-color: var(--scrollbar-thumb);
}
```

Los tokens actuales del pulgar son `--scrollbar-thumb` y
`--scrollbar-thumb-hover`, definidos en `:root` con colores `oklch(...)`.
Recuerda que Firefox ofrece el tamaño `thin` en lugar de una medida exacta en
píxeles. No añadas fondos blancos a las pistas de tablas o contenedores con
`overflow`.

### Diseño táctil: mobile y tablet first

- Diseña primero para teléfonos y tablets usados en el taller.
- Los botones, inputs, selectores y acciones principales deben tener un área
  táctil de al menos 44–48 px; usa `h-11`, `h-12` o `min-h-11` según el
  componente.
- En pantallas menores de 768 px, presenta las tablas extensas como tarjetas
  verticales apiladas (`md:hidden` para tarjetas y `hidden md:block` para la
  tabla de escritorio).
- Mantén las mismas funciones, permisos, validaciones y datos en ambas
  presentaciones. La versión móvil no debe perder acciones disponibles en
  escritorio.
- Usa espaciado suficiente entre controles y acciones para evitar pulsaciones
  accidentales. No dependas de hover como única forma de revelar información o
  acciones.
- En escritorio, conserva encabezados y alineación de columnas; los valores
  numéricos y monetarios se alinean a la derecha.

## 3. Arquitectura de componentes reutilizables

- Los componentes base reutilizables (botones, inputs, tarjetas, badges,
  modales y tablas) viven en `src/components/ui/`.
- Para clases condicionales, reutiliza `cn(...)` desde `src/lib/utils.ts`,
  basado en `clsx` y `tailwind-merge`.
- Sigue los patrones existentes de Radix UI y de los componentes del sistema
  antes de crear controles nuevos.
- Divide componentes complejos en subcomponentes con responsabilidades
  claras. Procura mantenerlos en torno a 150–200 líneas cuando sea práctico;
  prioriza una separación coherente y no fragmentes componentes por alcanzar un
  límite arbitrario.
- Mantén estilos y comportamiento compartidos entre vistas similares en
  componentes o utilidades existentes, evitando duplicar lógica de validación.

## 4. Jerarquía visual y contenido

- **Nombre del registro:** `text-foreground font-semibold`.
- **Valores principales:** `text-foreground`; precios y cantidades pueden usar
  `font-mono` y `tabular-nums` para facilitar su lectura y comparación.
- **Precio sugerido / llamada de atención:** resalta con el color primario y
  `font-bold`, sin competir con la acción principal de la pantalla.
- **Etiquetas, ayuda y metadatos:** `text-muted-foreground`, con tamaño y peso
  visual secundarios.
- **Badges:** úsalos para estado, marca o condición cuando ayuden a escanear
  los datos. Mantén contraste suficiente en temas claro y oscuro.
- Alinea a la izquierda nombres y texto; alinea a la derecha costos, precios,
  cantidades y otros valores numéricos.

## 5. Calidad, rendimiento y accesibilidad

- Importa iconos directamente desde `lucide-react`; acompaña los iconos de
  botones solo con icono con un nombre accesible (`aria-label`).
- Usa elementos HTML semánticos como `<main>`, `<header>`, `<section>`,
  `<article>` y `<nav>` según corresponda.
- Cada control de formulario debe tener una etiqueta explícita o un nombre
  accesible. Conserva los mensajes de validación y el feedback de estado para
  carga, error y éxito (`loading`, `error`, `success`).
- Los controles interactivos deben ser utilizables con teclado, tener estados
  de foco visibles y comunicar su estado deshabilitado.
- No uses estilos inline para resolver estilos visuales; prefiere utilidades
  Tailwind v4 y tokens de diseño. Las excepciones funcionales deben justificarse
  y no reemplazar el sistema de tokens.
- Valida cambios con los comandos existentes del proyecto, al menos el build,
  TypeScript, lint y las pruebas relacionadas cuando estén disponibles.

---

## Prompt maestro para Copilot Chat — estandarización UI/UX

Usa esta plantilla para revisar o mejorar una pantalla siguiendo esta guía:

```text
@workspace Revisa docs/FRONTEND_SPEC.md y aplica sus estándares enterprise al componente [NombreDelComponente.tsx].

1. Asegúrate de que botones, inputs, selectores y acciones cumplan el área táctil de 44–48 px para uso en taller.
2. Aplica la jerarquía semántica: text-muted-foreground para etiquetas y ayuda; text-foreground para nombres y valores; reserva el color primario para énfasis y acciones principales.
3. En tablas extensas, conserva la tabla en escritorio y presenta tarjetas verticales táctiles en pantallas menores de 768 px. Mantén paridad de datos, permisos, validaciones y acciones.
4. Usa los componentes existentes de src/components/ui/ y cn(...) desde src/lib/utils.ts. Evita duplicar controles o lógica existente.
5. Respeta Tailwind CSS v4, los tokens oklch y ambos temas. No introduzcas estilos inline ni colores fijos si existe un token semántico.
6. Conserva accesibilidad: etiquetas explícitas, nombres accesibles, foco visible, teclado y estados de carga, error y éxito.
7. Ejecuta las validaciones pertinentes y resume los archivos modificados y sus resultados.
```