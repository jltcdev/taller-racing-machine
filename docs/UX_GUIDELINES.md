# 🎨 GUÍA DE DISEÑO Y EXPERIENCIA DE USUARIO (UX/UI)

## 1. Principios de Diseño

- **Mobile & Tablet First:** Los mecánicos registran información en el taller con guantes o dedos; los controles interactivos deben ser grandes y de alta respuesta táctil.
- **Alto Contraste Directo:** Diferenciación visual clara entre etiquetas de campos (`text-muted-foreground`), valores ingresados (`text-foreground`) y datos críticos como placas o totales (`text-primary` / Naranja KTM)[cite: 28].

## 2. Especificaciones de Componentes

- **Form Inputs & Selects:** Altura mínima de `h-11` o `h-12` (`44px` - `48px`) en mobile.
- **Checklists de Inspección & Inventario:** Usar Botones/Cards con estado ON/OFF con borde activo `border-primary` e iluminación de fondo `bg-primary/10`.
- **Tablas Responsivas:** En pantallas `<768px`, convertir la tabla horizontal en tarjetas apiladas dinámicas.
