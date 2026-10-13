# Feature Specification: Rediseño Integral de la Pantalla de Login Gastronómico (UI/UX)

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 036  

---

## 1. Purpose & Overview

Modernizar y alinear la pantalla de inicio de sesión ([`app/login/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/login/page.tsx)) con la identidad visual global del ERP Gastronómico:
- **Identidad de Marca**: Colores corporativos (Rojo brasa gastronómico `#b91c1c`, acentos dorados/ámbar y tonos oscuros elegantes).
- **Diseño Split-Screen (Desktop)**: Columna izquierda de alto impacto visual con branding, propuesta de valor y módulos clave (Salones, Mozo Móvil, Contabilidad SUNAT), y columna derecha centrada en la autenticación.
- **Experiencia de Usuario (UX)**:
  - Selector de tema Claro / Oscuro accesible desde la pantalla de login (`ThemeToggle`).
  - Inputs con iconos contextuales (`User`, `Lock`).
  - Toggle interactivo de visibilidad de contraseña (Mostrar/Ocultar con iconos `Eye` / `EyeOff`).
  - Botón de envío con estado de carga interactivo y spinner.
  - Alerta de error clara con icono `AlertCircle` y fondo suave.
  - Accesos y etiquetas informativas de los roles operativos (Mozo, Caja, Administrador).

---

## 2. Requirements & UI Guidelines

### User Story 1 - Presentación Visual Gastronómica (Priority: P1)
Como usuario que ingresa al sistema:
- Encuentra una interfaz moderna con el emblema de la pollería, iluminación suave y tipografía clara.
- Puede alternar entre Modo Claro y Modo Oscuro según el entorno de trabajo (caja con luz tenue o ambiente diurno).

### User Story 2 - Entrada de Datos Cómoda y Segura (Priority: P1)
Como mozo o cajero al ingresar credenciales:
- Los campos muestran iconos descriptivos e indicaciones claras en sus placeholders.
- Cuenta con un botón para revelar la contraseña y evitar errores de tipeo en pantallas táctiles o dispositivos móviles.
- Al enviar las credenciales, el botón muestra animación de carga y retroalimentación inmediata.

---

## 3. Technical Changes

- [`app/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/page.tsx): Corrección del error de consola en Next.js unificando keys únicas (`key={`${action.href}-${action.label}`}`) y corrigiendo href en `QUICK_ACTIONS`.
- [`components/personalized/AppLayoutShell.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/components/personalized/AppLayoutShell.tsx): Contenedor de layout perimetral que elimina el desplazamiento y margen `md:pl-64` en `/login`, permitiendo que el login use el 100% del viewport en smartphone, tablet, laptop y desktop.
- [`app/layout.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/layout.tsx): Integración de `AppLayoutShell`.
- [`app/login/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/login/page.tsx): Rediseño 100% corporativo, limpio y privado con identidad oficial de **Pollería Los Betos**, destacando el logo oficial con su platillo emblemático (`/Los_Betos_Logo.jpg`), eliminando descripciones de módulos internos o datos privados para proteger la confidencialidad de la empresa frente al personal o público.
- [`proxy.ts`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/proxy.ts): Exclusión perimetral de imágenes estáticas y logo oficial para carga pública sin autenticación previa.

