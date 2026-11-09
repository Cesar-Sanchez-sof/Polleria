'use client';

import React, { useState } from 'react';
import { Copy, Check, FileCode, Layers, ShieldCheck } from 'lucide-react';

const MERMAID_DIAGRAM_CODE = `flowchart TD
    %% 1. PRESENTACION Y FRONTENDS
    subgraph FRONTEND ["1. CAPA DE PRESENTACIÓN / FRONTEND (app/)"]
        direction TB
        F_SALES["🍗 Ventas: POS Salón, Barra, Mesas & KDS Cocina"]
        F_PURCH["🛒 Compras: Órdenes, Facturas & Catálogo Proveedores"]
        F_INV["🥕 Inventario: Kardex Ponderado, Recetas & Transformación"]
        F_ACC["⚖️ Contabilidad: Libro Diario, Mayor, Balances, PLE & SIRE"]
        F_HR["👥 RRHH: Marcación con IP, Turnos, Contratos & Planilla"]
        F_SEC["🛡️ Seguridad: Gestión de Roles, Permisos RBAC & Auditoría"]
        F_SET["⚙️ Ajustes: Series B001/F001, Salones & Comanderas"]
        F_AI["🤖 Asistente IA: Chat Financiero & Dictado por Voz"]
    end

    %% 2. API GATEWAY Y SEGURIDAD
    subgraph GATEWAY ["2. CAPA DE TRANSPORTE HTTP & SEGURIDAD (app/api/**)"]
        direction TB
        APPGW["API Gateway Centralizado: createApiHandler()"]
        AUTH_GUARD["Guardián RBAC (80+ Permisos) + Sesión JWT HttpOnly"]
        ZOD_VAL["Validación de Schemas Zod + Mapeo de DomainError"]
        ESLINT_RULE["🛡️ ESLint Enforcement: Cero importaciones de Prisma en app/"]
    end

    %% 3. SERVICIOS DE DOMINIO DDD
    subgraph DOMAIN ["3. SERVICIOS DE DOMINIO DDD (lib/services/** - 8 Bounded Contexts)"]
        direction TB
        D_SALES["sales/: Pedidos, Cuentas Split, Mesas, Cajas, Arqueos"]
        D_PURCH["purchases/: Órdenes de compra, Proveedores, Facturas"]
        D_INV["inventory/: Escandallos, Descuento automático, Kardex"]
        D_ACC["accounting/: Asientos PCGE, Balances, PLE 5.1/14.1, SIRE"]
        D_HR["hr/: Asistencia, Deducciones AFP/ONP, Cálculo Planilla"]
        D_SEC["security/: AuditLog Append-Only, Bcrypt, Usuarios"]
        D_SET["settings/: Series SUNAT, Configuración de Restaurante"]
        D_INT["integrations/: Adaptador UBL 2.1, S3, Mercado Pago, Yape"]
    end

    %% 4. MICROSERVICIOS DE IA
    subgraph AI_SERVICES ["4. MICROSERVICIOS IA ASISTENTE"]
        direction TB
        AI_R["ai-service (Python / FastAPI): Modelo R (XiYanSQL + LoRA)"]
        AI_AGENTS["agents-service (Python / Render): Gemini + Groq (P-4 Filter)"]
    end

    %% 5. PERSISTENCIA Y BD
    subgraph PERSISTENCE ["5. CAPA DE PERSISTENCIA (@/lib/prisma)"]
        direction TB
        PRISMA_CLIENT["Prisma ORM Singleton (Único con acceso a BD)"]
        PG_NEON[("PostgreSQL 16 en Neon Tech + PgBouncer Pooling")]
        AI_ROLE[("Rol DB ai_readonly: Solo SELECTs en Transacción Read-Only")]
    end

    %% 6. SERVICIOS EXTERNOS Y CLOUD
    subgraph EXTERNAL ["6. SERVICIOS EXTERNOS & CLOUD"]
        direction TB
        EXT_SUNAT["SUNAT: Facturación Electrónica SOAP (UBL 2.1) + SIRE + PLE"]
        EXT_PAY["Mercado Pago API & Yape QR Dinámico (Webhooks HMAC)"]
        EXT_S3["AWS S3 / Neon Object Store: XMLs, CDRs y PDFs"]
        EXT_RENIEC["RENIEC / SUNAT Lookup: Consulta de DNI y RUC"]
        EXT_PRINTER["Hardware ESC/POS: Impresoras de red TCP 9100"]
    end

    %% CONEXIONES END-TO-END
    FRONTEND -->|Peticiones HTTPS / JSON| APPGW
    APPGW --> AUTH_GUARD
    AUTH_GUARD --> ZOD_VAL
    ZOD_VAL --> DOMAIN

    %% Conexiones con Microservicios IA
    APPGW -->|X-ERP-Identity / Token Interno| AI_SERVICES
    AI_SERVICES -->|SELECTs Validados| AI_ROLE
    AI_ROLE --> PG_NEON

    %% Servicios de Dominio a Persistencia
    D_SALES & D_PURCH & D_INV & D_ACC & D_HR & D_SEC & D_SET -->|prisma.$transaction ACID| PRISMA_CLIENT
    PRISMA_CLIENT -->|Pool de Conexiones TCP| PG_NEON

    %% Interacciones entre Dominios
    D_SALES -->|Descarga por Receta| D_INV
    D_SALES -->|Asiento de Venta| D_ACC
    D_PURCH -->|Asiento de Compra| D_ACC
    D_PURCH -->|Ingreso a Kardex| D_INV
    D_HR -->|Asiento de Nómina| D_ACC

    %% Servicios a Integraciones Externas
    D_SALES & D_PURCH --> D_INT
    D_INT -->|XML UBL 2.1 Firmado / SOAP| EXT_SUNAT
    D_INT -->|Cobro QR & Webhooks HMAC| EXT_PAY
    D_INT -->|Subida segura Presigned URL| EXT_S3
    D_INT -->|Validación RUC/DNI en línea| EXT_RENIEC
    D_SALES -->|Comandas de Cocina/Bar| EXT_PRINTER`;

export function MermaidView() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MERMAID_DIAGRAM_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col gap-5 p-4 overflow-y-auto">
      {/* Top Banner */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Especificación de Arquitectura de Dominio (Formato Mermaid)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diagrama canónico de las 6 capas del ERP Pollería, desde el Frontend hasta la Base de Datos, AWS S3 y servicios gubernamentales.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors cursor-pointer shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Copiado al Portapapeles
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Copiar Código Mermaid
            </>
          )}
        </button>
      </div>

      {/* Layer Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/05 p-3.5">
          <div className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">
            1. Frontends & Clientes Web
          </div>
          <p className="text-xs text-foreground/80">
            POS Salón, Mozo Móvil, KDS Cocina, Compras, Inventario, Contabilidad, RRHH, Seguridad y Asistente IA.
          </p>
        </div>

        <div className="rounded-xl border border-violet-500/30 bg-violet-500/05 p-3.5">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-1">
            2. Transporte & API Gateway
          </div>
          <p className="text-xs text-foreground/80">
            createApiHandler, Guard RBAC (80+ permisos), validadores Zod y regla ESLint estricta de 0 Prisma en app/.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/05 p-3.5">
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
            3. Servicios de Dominio DDD
          </div>
          <p className="text-xs text-foreground/80">
            8 Bounded Contexts puros (sales, purchases, inventory, accounting, hr, security, settings, integrations).
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/05 p-3.5">
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
            4. Microservicios IA Asistente
          </div>
          <p className="text-xs text-foreground/80">
            ai-service (Python / Modelo R LoRA) y agents-service (Gemini / Groq) con rol de solo lectura ai_readonly.
          </p>
        </div>

        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/05 p-3.5">
          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
            5. Persistencia & PostgreSQL
          </div>
          <p className="text-xs text-foreground/80">
            Prisma ORM Singleton en lib/prisma y PostgreSQL 16 serverless en Neon Tech con connection pooling PgBouncer.
          </p>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/05 p-3.5">
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
            6. Servicios Externos & Cloud
          </div>
          <p className="text-xs text-foreground/80">
            SUNAT (UBL 2.1 SOAP), Mercado Pago, Yape QR con webhooks HMAC, AWS S3 y hardware ESC/POS en red.
          </p>
        </div>
      </div>

      {/* Code Container */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex-1 flex flex-col">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-muted-foreground flex items-center gap-1.5">
            <FileCode className="h-3.5 w-3.5 text-primary" />
            diagrama-arquitectura.mermaid
          </span>
          <span className="text-[11px] text-muted-foreground">
            Sintaxis nativa Mermaid v10+
          </span>
        </div>

        <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-foreground bg-muted/15 flex-1 select-all">
          {MERMAID_DIAGRAM_CODE}
        </pre>
      </div>
    </div>
  );
}
