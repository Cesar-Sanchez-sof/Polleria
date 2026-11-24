/**
 * Fuente estructurada del Manual de Despliegue de Pollería ERP.
 * Basada en la configuración real del repositorio: package.json, .env.example.front,
 * .github/workflows/ci.yml y agents-service/render.yaml.
 */

export interface DeploymentEnvVar {
  name: string;
  service: "Next.js / Vercel" | "Base de Datos" | "Integraciones" | "Asistente IA / Agents";
  required: boolean;
  example: string;
  description: string;
}

export interface DeploymentCommandBlock {
  label: string;
  command: string;
  notes?: string;
}

export interface DeploymentSection {
  id: string;
  badge: string;
  title: string;
  summary: string;
  checklist: readonly string[];
  commands?: readonly DeploymentCommandBlock[];
}

export interface DeploymentTroubleshootingItem {
  symptom: string;
  cause: string;
  resolution: string;
}

export const DEPLOYMENT_ENV_VARS: readonly DeploymentEnvVar[] = [
  {
    name: "DATABASE_URL",
    service: "Base de Datos",
    required: true,
    example: "postgresql://user:pass@ep-xxx.neon.tech/polleria?sslmode=require&options=-c%20timezone=America/Lima&connect_timeout=30",
    description: "Cadena PostgreSQL (Neon recomendado). Incluye timezone=America/Lima para Trujillo/Perú y connect_timeout=30 para cold starts.",
  },
  {
    name: "SESSION_SECRET",
    service: "Next.js / Vercel",
    required: true,
    example: "clave_aleatoria_minimo_32_caracteres_seguros",
    description: "Secreto de firma JWT para cookies HttpOnly (mínimo 32 caracteres).",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    service: "Next.js / Vercel",
    required: true,
    example: "https://tu-polleria.vercel.app",
    description: "URL pública base de la aplicación (usada en enlaces, callbacks y webhooks).",
  },
  {
    name: "TZ",
    service: "Next.js / Vercel",
    required: true,
    example: "America/Lima",
    description: "Zona horaria del servidor para emisión de comprobantes, arqueos y asistencia.",
  },
  {
    name: "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET / AWS_REGION / AWS_ENDPOINT_URL_S3",
    service: "Integraciones",
    required: false,
    example: "AWS_S3_BUCKET=comprobantes | AWS_REGION=us-east-1",
    description: "Credenciales S3 compatibles con AWS S3, Neon Object Storage o Cloudflare R2 para respaldo de comprobantes e imágenes.",
  },
  {
    name: "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN",
    service: "Integraciones",
    required: false,
    example: "https://xxx.upstash.io",
    description: "Caché distribuida y rate limiting en entornos serverless.",
  },
  {
    name: "MERCADO_PAGO_ACCESS_TOKEN / MERCADO_PAGO_WEBHOOK_SECRET",
    service: "Integraciones",
    required: false,
    example: "APP_USR-xxxx / whsec_xxxx",
    description: "Credenciales de cobro con tarjeta/Yape y validación HMAC de webhooks de pago.",
  },
  {
    name: "JSON_PE_TOKEN",
    service: "Integraciones",
    required: false,
    example: "token_consulta_dni_ruc",
    description: "Token para consulta en tiempo real de DNI (RENIEC) y RUC (SUNAT).",
  },
  {
    name: "SUNAT_RUC / SUNAT_USER / SUNAT_PASSWORD / SUNAT_ENDPOINT / SUNAT_CERT_PEM / SUNAT_PRIVATE_KEY_PEM",
    service: "Integraciones",
    required: false,
    example: "SUNAT_RUC=20000000001 | SUNAT_USER=MODDATOS",
    description: "Credenciales SOL y certificado digital .pem para facturación electrónica UBL 2.1 (Beta o Producción).",
  },
  {
    name: "AGENTS_SERVICE_URL / AGENTS_SERVICE_INTERNAL_TOKEN / AI_ASSISTANT_IDENTITY_KEY",
    service: "Asistente IA / Agents",
    required: false,
    example: "https://polleria-agents-service.onrender.com",
    description: "Conexión segura al microservicio Python de solo lectura (Gemini / Groq) desplegado en Render.",
  },
  {
    name: "AI_SERVICE_URL / AI_SERVICE_INTERNAL_TOKEN / GROQ_API_KEY",
    service: "Asistente IA / Agents",
    required: false,
    example: "http://127.0.0.1:8001 | gsk_xxxx",
    description: "Servicio LoRA (Modelo R) y clave de Groq para dictado por voz (Whisper).",
  },
];

export const DEPLOYMENT_SECTIONS: readonly DeploymentSection[] = [
  {
    id: "arquitectura-servicios",
    badge: "1. Topología",
    title: "Arquitectura de Servicios y Prerrequisitos",
    summary: "Componentes que conforman el ecosistema productivo del ERP Pollería.",
    checklist: [
      "Aplicación principal Full-Stack: Next.js 16.4 (React 19, TypeScript 5) ejecutándose en Node.js 24 (Vercel o servidor Node).",
      "Base de datos: PostgreSQL en Neon Serverless con zona horaria America/Lima.",
      "Almacenamiento de objetos: AWS S3, Cloudflare R2 o Neon Object Storage para comprobantes y activos de marca.",
      "Caché y rate limiting: Upstash Redis (REST).",
      "Microservicio opcional de agentes IA (agents-service/): Python 3.11.9 en Render usando el Blueprint agents-service/render.yaml y rol PostgreSQL ai_readonly.",
    ],
  },
  {
    id: "instalacion-local-bd",
    badge: "2. Base de Datos",
    title: "Instalación, Sincronización de Prisma y Seed Inicial",
    summary: "Pasos para preparar dependencias, generar el cliente Prisma y poblar roles, permisos, cuentas contables y usuario administrador.",
    checklist: [
      "Copiar .env.example.front a .env y completar DATABASE_URL y SESSION_SECRET.",
      "Generar Prisma Client y sincronizar el esquema con PostgreSQL.",
      "Ejecutar el seed principal (npm run db:seed) para crear el catálogo de permisos RBAC, roles base (ADMIN, CAJERO, MESERO, COCINERO, CONTADOR, RRHH), plan contable y usuario admin.",
      "Cambiar la contraseña por defecto del usuario admin inmediatamente después del primer ingreso en producción.",
    ],
    commands: [
      {
        label: "Instalar dependencias y generar Prisma Client",
        command: "npm ci\nnpx prisma generate",
      },
      {
        label: "Aplicar esquema en base de datos y ejecutar seed",
        command: "npx prisma db push\nnpm run db:seed",
        notes: "Para entorno demo de RR. HH. adicional puedes ejecutar opcionalmente: npm run db:seed:hr",
      },
      {
        label: "Iniciar servidor local de desarrollo o producción",
        command: "npm run dev\n# O en modo producción:\nnpm run build\nnpm run start",
      },
    ],
  },
  {
    id: "despliegue-vercel-render",
    badge: "3. Cloud Deploy",
    title: "Despliegue en Vercel (Web/API) y Render (agents-service)",
    summary: "Configuración recomendada en la nube para el frontend/API Next.js y el servicio Python de asistentes SQL de solo lectura.",
    checklist: [
      "Vercel: Conectar el repositorio GitHub, seleccionar rama de producción main (y develop para Preview/Staging), Node.js 24.x y Build Command `npm run build` (ejecuta `prisma generate && next build`).",
      "Vercel Env Vars: Cargar todas las variables de .env.example.front para los entornos Production y Preview.",
      "Render (agents-service): Crear un Blueprint apuntando a `agents-service/render.yaml` (runtime Python 3.11.9, rootDir `agents-service`, startCommand `python -m agents_service.main`, healthcheck `/v1/health`).",
      "Seguridad de agentes IA: Usar `DATABASE_URL_READONLY` (rol PostgreSQL `ai_readonly`) y compartir `AGENTS_SERVICE_INTERNAL_TOKEN` y `AI_ASSISTANT_IDENTITY_KEY` entre Vercel y Render.",
    ],
    commands: [
      {
        label: "Ejecutar agents-service localmente (Windows PowerShell)",
        command: "./agents-service/scripts/start-local.ps1",
        notes: "Asegúrate de configurar agents-service/.env a partir de agents-service/.env.example.agents.",
      },
    ],
  },
  {
    id: "ci-cd-ramas",
    badge: "4. CI/CD & Git",
    title: "Pipeline CI/CD, Calidad y Flujo de Ramas",
    summary: "Validaciones automáticas definidas en .github/workflows/ci.yml antes de promover cambios a producción.",
    checklist: [
      "Cada push o Pull Request hacia `develop` dispara el workflow `CI Pipeline` en Ubuntu con Node.js 24.",
      "El pipeline inyecta `timezone=America/Lima` y `connect_timeout=30`, despierta Neon con reintentos, sincroniza Prisma (`db push` + `db seed`) y ejecuta Vitest, Build, ESLint y Playwright E2E.",
      "ESLint bloquea con nivel `error` cualquier importación de `@/lib/prisma` fuera de `lib/services/**` (regla de arquitectura en 3 capas).",
      "Promover de `develop` a `main` únicamente cuando todos los checks de CI estén en verde.",
    ],
    commands: [
      {
        label: "Validación completa previa a Pull Request",
        command: "npx vitest run\nnpm run lint\nnpm run build",
        notes: "Para correr también las pruebas E2E de Playwright en local: npm run test:e2e",
      },
    ],
  },
];

export const DEPLOYMENT_TROUBLESHOOTING: readonly DeploymentTroubleshootingItem[] = [
  {
    symptom: "Error P1001 al conectar con Neon en el primer arranque",
    cause: "La instancia serverless de Neon está suspendida (cold start) y tarda unos segundos en despertar.",
    resolution: "Añade `connect_timeout=30` a `DATABASE_URL` y reintenta la conexión antes de correr migraciones (como hace .github/workflows/ci.yml).",
  },
  {
    symptom: "Comprobantes, cierres de caja o asistencia muestran +5 horas de desfase",
    cause: "Falta configurar la zona horaria `America/Lima` en la conexión PostgreSQL o en el entorno.",
    resolution: "Define `TZ=America/Lima` y agrega `?options=-c%20timezone=America/Lima` al parámetro `DATABASE_URL`.",
  },
  {
    symptom: "El asistente IA responde 'No hay modelos disponibles'",
    cause: "Las URLs/tokens del servicio no están configurados o los interruptores están apagados.",
    resolution: "Verifica `AGENTS_SERVICE_URL`, `AGENTS_SERVICE_INTERNAL_TOKEN`, `AI_ASSISTANT_IDENTITY_KEY` y activa los interruptores en Configuración → Desarrollador.",
  },
  {
    symptom: "Falla el build por importación de `@/lib/prisma` en `app/`",
    cause: "Violación de la regla de Arquitectura por Dominio en 3 capas (`no-restricted-imports` en eslint.config.mjs).",
    resolution: "Mueve toda consulta Prisma a un servicio dentro de `lib/services/<contexto>/` e invócalo desde el handler usando `createApiHandler`.",
  },
];
