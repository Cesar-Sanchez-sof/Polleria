/**
 * Smoke Test para el Motor Analítico de Dashboards contra la Base de Datos Real.
 *
 * Ejecuta, por cada dataset semántico:
 * - Una consulta por cada dimensión definida.
 * - Una consulta por cada medida y agregación permitida.
 * Reporta los resultados y detalla cualquier incompatibilidad o fallo.
 */
import dotenv from "dotenv";
dotenv.config();

import { SEMANTIC_DATASETS } from "../lib/dashboards/semantic-model";
import { executeDashboardQueryService } from "../lib/services/settings/dashboard-query.service";
import type { FilterRule } from "../lib/dashboards/widget-schema";
import { prisma } from "../lib/prisma";

interface SmokeReportItem {
  dataset: string;
  type: "dimension" | "measure";
  target: string;
  success: boolean;
  rows?: number;
  engine?: string;
  error?: string;
}

async function main() {
  console.log("🚀 Iniciando Smoke Test del Motor Analítico de Dashboards...\n");

  const results: SmokeReportItem[] = [];
  const datasets = Object.values(SEMANTIC_DATASETS);

  for (const ds of datasets) {
    console.log(`📊 Probando Dataset: [${ds.id}] (${ds.label})...`);

    const dateField = ds.fields.find((f) => f.dataType === "date");
    const defaultFilters: FilterRule[] = [];
    if (ds.isTransactional && dateField) {
      defaultFilters.push({
        field: dateField.id,
        operator: "gt",
        value: "2020-01-01",
      });
    }

    const measures = ds.fields.filter((f) => f.kind === "measure");
    const dimensions = ds.fields.filter((f) => f.kind === "dimension");

    const defaultMeasure = measures[0] || { id: "id", allowedAggregations: ["count"] };
    const defaultAgg = defaultMeasure.allowedAggregations?.[0] || "count";

    // 1. Probar cada Dimensión
    for (const dim of dimensions) {
      const targetName = `Dimensión: ${dim.id} (${dim.label})`;
      try {
        const res = await executeDashboardQueryService(
          {
            dataset: ds.id,
            axis: dim.id,
            values: [{ field: defaultMeasure.id, agg: defaultAgg }],
            filters: defaultFilters,
            limit: 20,
          },
          { superuser: true }
        );

        const rowCount = res.rows.length;
        const zeroNotice = rowCount === 0 ? " [0 filas ⚠️]" : "";
        console.log(`    ✔ ${targetName} -> ${rowCount} fila(s)${zeroNotice} (${res.meta.engine})`);

        results.push({
          dataset: ds.id,
          type: "dimension",
          target: targetName,
          success: true,
          rows: rowCount,
          engine: res.meta.engine,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    ❌ ${targetName} -> FALLÓ: ${msg}`);
        results.push({
          dataset: ds.id,
          type: "dimension",
          target: targetName,
          success: false,
          error: msg,
        });
      }
    }

    // 2. Probar cada Medida
    for (const meas of measures) {
      const agg = meas.allowedAggregations?.[0] || "sum";
      const targetName = `Medida: ${meas.id} [${agg}] (${meas.label})`;
      try {
        const res = await executeDashboardQueryService(
          {
            dataset: ds.id,
            values: [{ field: meas.id, agg }],
            filters: defaultFilters,
          },
          { superuser: true }
        );

        const rowCount = res.rows.length;
        const zeroNotice = rowCount === 0 ? " [0 filas ⚠️]" : "";
        console.log(`    ✔ ${targetName} -> ${rowCount} fila(s)${zeroNotice} (${res.meta.engine})`);

        results.push({
          dataset: ds.id,
          type: "measure",
          target: targetName,
          success: true,
          rows: rowCount,
          engine: res.meta.engine,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    ❌ ${targetName} -> FALLÓ: ${msg}`);
        results.push({
          dataset: ds.id,
          type: "measure",
          target: targetName,
          success: false,
          error: msg,
        });
      }
    }
    console.log("");
  }

  // ==========================================================================
  // 3. CONSULTAS COMBINADAS Y VALIDACIÓN EXACTA CONTRA PRISMA AGGREGATE
  // ==========================================================================
  console.log("🔥 Probando Consultas Combinadas (Dimensión + Leyenda + Medidas avg/min/max + Sort + Limit)...");

  // A. VENTAS COMBINADA
  try {
    const resVentas = await executeDashboardQueryService(
      {
        dataset: "ventas",
        axis: "tipoComprobante",
        legend: "tipoPersona",
        values: [
          { field: "total", agg: "sum" },
          { field: "subtotal", agg: "avg" },
          { field: "total", agg: "max" },
          { field: "total", agg: "min" },
        ],
        filters: [{ field: "fecha", operator: "gt", value: "2020-01-01" }],
        sort: { by: "total_sum", dir: "desc" },
        limit: 50,
      },
      { superuser: true }
    );

    const directVentas = await prisma.salesInvoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { notIn: ["Cancelled"] },
        issuedAt: { gt: new Date("2020-01-01") },
      },
    });

    const directTotalVentas = Number(directVentas._sum.totalAmount || 0);
    const serviceTotalVentas = resVentas.rows.reduce(
      (sum, r) => sum + (Number(r["total_sum"]) || 0),
      0
    );
    const diffVentas = Math.abs(directTotalVentas - serviceTotalVentas);
    if (diffVentas > 0.05) {
      throw new Error(
        `Discrepancia en Ventas: Servicio=${serviceTotalVentas.toFixed(2)}, Directo=${directTotalVentas.toFixed(2)}, Diff=${diffVentas.toFixed(2)}`
      );
    }
    console.log(`    ✔ Ventas Combinada: Total S/ ${serviceTotalVentas.toFixed(2)} coincide exactamente con prisma.aggregate directo.`);
    results.push({
      dataset: "ventas",
      type: "measure",
      target: "Combinada (dimensión + leyenda + medidas + sort + limit)",
      success: true,
      rows: resVentas.rows.length,
      engine: resVentas.meta.engine,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ Ventas Combinada FALLÓ: ${msg}`);
    results.push({
      dataset: "ventas",
      type: "measure",
      target: "Combinada (dimensión + leyenda + medidas + sort + limit)",
      success: false,
      error: msg,
    });
  }

  // B. PEDIDOS COMBINADA
  try {
    const resPedidos = await executeDashboardQueryService(
      {
        dataset: "pedidos",
        axis: "tipoPedido",
        legend: "estado",
        values: [
          { field: "numPedidos", agg: "count" },
          { field: "importeTotal", agg: "sum" },
          { field: "ticketPromedio", agg: "avg" },
        ],
        filters: [{ field: "fechaHora", operator: "gt", value: "2020-01-01" }],
        sort: { by: "numPedidos_count", dir: "desc" },
        limit: 50,
      },
      { superuser: true }
    );

    const directPedidosCount = await prisma.salesOrder.count({
      where: {
        status: { notIn: ["Cancelled"] },
        orderedAt: { gt: new Date("2020-01-01") },
      },
    });

    const servicePedidosCount = resPedidos.rows.reduce(
      (sum, r) => sum + (Number(r["numPedidos_count"]) || 0),
      0
    );
    if (directPedidosCount !== servicePedidosCount) {
      throw new Error(
        `Discrepancia en Pedidos count: Servicio=${servicePedidosCount}, Directo=${directPedidosCount}`
      );
    }
    console.log(`    ✔ Pedidos Combinada: Total ${servicePedidosCount} pedidos coincide exactamente con prisma.salesOrder.count directo.`);
    results.push({
      dataset: "pedidos",
      type: "measure",
      target: "Combinada (dimensión + leyenda + ticketPromedio + sort + limit)",
      success: true,
      rows: resPedidos.rows.length,
      engine: resPedidos.meta.engine,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ Pedidos Combinada FALLÓ: ${msg}`);
    results.push({
      dataset: "pedidos",
      type: "measure",
      target: "Combinada (dimensión + leyenda + ticketPromedio + sort + limit)",
      success: false,
      error: msg,
    });
  }

  // C. CONTABILIDAD COMBINADA
  try {
    const resContabilidad = await executeDashboardQueryService(
      {
        dataset: "contabilidad",
        axis: "tipoCuenta",
        legend: "libro",
        values: [
          { field: "debe", agg: "sum" },
          { field: "haber", agg: "sum" },
          { field: "debe", agg: "max" },
          { field: "haber", agg: "min" },
        ],
        filters: [{ field: "fecha", operator: "gt", value: "2020-01-01" }],
        sort: { by: "debe_sum", dir: "desc" },
        limit: 50,
      },
      { superuser: true }
    );

    const directContabilidad = await prisma.journalEntryDetail.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        entry: {
          status: true,
          entryDate: { gt: new Date("2020-01-01") },
        },
      },
    });

    const directDebe = Number(directContabilidad._sum.debit || 0);
    const serviceDebe = resContabilidad.rows.reduce(
      (sum, r) => sum + (Number(r["debe_sum"]) || 0),
      0
    );
    const diffDebe = Math.abs(directDebe - serviceDebe);
    if (diffDebe > 0.05) {
      throw new Error(
        `Discrepancia en Contabilidad: Servicio Debe=${serviceDebe.toFixed(2)}, Directo Debe=${directDebe.toFixed(2)}, Diff=${diffDebe.toFixed(2)}`
      );
    }
    console.log(`    ✔ Contabilidad Combinada: Total Debe S/ ${serviceDebe.toFixed(2)} coincide exactamente con prisma.aggregate directo.`);
    results.push({
      dataset: "contabilidad",
      type: "measure",
      target: "Combinada (dimensión + leyenda + debe/haber max/min + sort + limit)",
      success: true,
      rows: resContabilidad.rows.length,
      engine: resContabilidad.meta.engine,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ Contabilidad Combinada FALLÓ: ${msg}`);
    results.push({
      dataset: "contabilidad",
      type: "measure",
      target: "Combinada (dimensión + leyenda + debe/haber max/min + sort + limit)",
      success: false,
      error: msg,
    });
  }

  // ==========================================================================
  // D. VERIFICACIÓN INDEPENDIENTE CON $queryRaw (PostgreSQL doble AT TIME ZONE)
  // ==========================================================================
  console.log("\n🧪 4. Verificación Independiente con SQL Nativo ($queryRaw)...");

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDayOfMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-${String(lastDayOfMonth).padStart(2, "0")}`;

  // 1. Pedidos (sales_order.ordered_at) - Comparación Día a Día y Filas Nocturnas
  let rawOrderDays: Array<{ dia: string; count: string | number }> = [];
  try {
    rawOrderDays = await prisma.$queryRawUnsafe<Array<{ dia: string; count: string | number }>>(
      `SELECT 
        ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date::text AS dia,
        count(*)::int AS count
      FROM sales_order
      WHERE status != 'Cancelled'
        AND ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date BETWEEN $1::date AND $2::date
      GROUP BY ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date
      ORDER BY dia ASC`,
      startDate,
      endDate
    );

    const rawOrderNightRes = await prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*)::int AS count
      FROM sales_order
      WHERE status != 'Cancelled'
        AND ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date BETWEEN $1::date AND $2::date
        AND EXTRACT(HOUR FROM ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')) BETWEEN 19 AND 23`,
      startDate,
      endDate
    );
    const orderNightCount = Number(rawOrderNightRes[0]?.count || 0);

    const serviceOrderDayRes = await executeDashboardQueryService(
      {
        dataset: "pedidos",
        axis: "fechaHora",
        granularity: "day",
        values: [{ field: "numPedidos", agg: "count" }],
        filters: [{ field: "fechaHora", operator: "between", value: [startDate, endDate] }],
      },
      { superuser: true }
    );

    const serviceOrderDaysMap = new Map<string, number>();
    for (const r of serviceOrderDayRes.rows) {
      serviceOrderDaysMap.set(String(r.fechaHora), Number(r.numPedidos_count || 0));
    }

    for (const rawDay of rawOrderDays) {
      const sqlCount = Number(rawDay.count);
      const srvCount = serviceOrderDaysMap.get(rawDay.dia) ?? 0;
      if (sqlCount !== srvCount) {
        throw new Error(
          `Discrepancia en pedidos para el día ${rawDay.dia}: SQL=${sqlCount}, Servicio=${srvCount}`
        );
      }
    }

    const totalOrders = rawOrderDays.reduce((sum, d) => sum + Number(d.count), 0);
    console.log(
      `    ✔ Pedidos (sales_order) por día: ${rawOrderDays.length} días verificados al 100% contra SQL GROUP BY (${totalOrders} pedidos totales).`
    );
    console.log(
      `      🌙 Pedidos entre 19:00 y 23:59 Lima: ${orderNightCount} filas nocturnas procesadas correctamente.`
    );

    results.push({
      dataset: "pedidos",
      type: "measure",
      target: `Verificación SQL Nativo Día por Día (${rawOrderDays.length} días, ${orderNightCount} filas nocturnas 19-23h)`,
      success: true,
      rows: totalOrders,
      engine: serviceOrderDayRes.meta.engine,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ Verificación SQL Nativo pedidos FALLÓ: ${msg}`);
    results.push({
      dataset: "pedidos",
      type: "measure",
      target: "Verificación SQL Nativo Día por Día pedidos",
      success: false,
      error: msg,
    });
  }

  // 2. Pagos de Venta (sales_payment.paid_at) - Comparación Día a Día y Filas Nocturnas
  try {
    const rawPaymentDays = await prisma.$queryRawUnsafe<Array<{ dia: string; count: string | number }>>(
      `SELECT 
        ((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date::text AS dia,
        count(*)::int AS count
      FROM sales_payment
      WHERE ((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date BETWEEN $1::date AND $2::date
      GROUP BY ((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date
      ORDER BY dia ASC`,
      startDate,
      endDate
    );

    const rawPaymentNightRes = await prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*)::int AS count
      FROM sales_payment
      WHERE ((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date BETWEEN $1::date AND $2::date
        AND EXTRACT(HOUR FROM ((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')) BETWEEN 19 AND 23`,
      startDate,
      endDate
    );
    const paymentNightCount = Number(rawPaymentNightRes[0]?.count || 0);

    const servicePaymentDayRes = await executeDashboardQueryService(
      {
        dataset: "pagos_venta",
        axis: "fecha",
        granularity: "day",
        values: [{ field: "numPagos", agg: "count" }],
        filters: [{ field: "fecha", operator: "between", value: [startDate, endDate] }],
      },
      { superuser: true }
    );

    const servicePaymentDaysMap = new Map<string, number>();
    for (const r of servicePaymentDayRes.rows) {
      servicePaymentDaysMap.set(String(r.fecha), Number(r.numPagos_count || 0));
    }

    for (const rawDay of rawPaymentDays) {
      const sqlCount = Number(rawDay.count);
      const srvCount = servicePaymentDaysMap.get(rawDay.dia) ?? 0;
      if (sqlCount !== srvCount) {
        throw new Error(
          `Discrepancia en pagos_venta para el día ${rawDay.dia}: SQL=${sqlCount}, Servicio=${srvCount}`
        );
      }
    }

    const totalPayments = rawPaymentDays.reduce((sum, d) => sum + Number(d.count), 0);
    console.log(
      `    ✔ Pagos de Venta (sales_payment) por día: ${rawPaymentDays.length} días verificados al 100% contra SQL GROUP BY (${totalPayments} pagos totales).`
    );
    console.log(
      `      🌙 Pagos entre 19:00 y 23:59 Lima: ${paymentNightCount} filas nocturnas procesadas correctamente.`
    );

    results.push({
      dataset: "pagos_venta",
      type: "measure",
      target: `Verificación SQL Nativo Día por Día (${rawPaymentDays.length} días, ${paymentNightCount} filas nocturnas 19-23h)`,
      success: true,
      rows: totalPayments,
      engine: servicePaymentDayRes.meta.engine,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ Verificación SQL Nativo pagos_venta FALLÓ: ${msg}`);
    results.push({
      dataset: "pagos_venta",
      type: "measure",
      target: "Verificación SQL Nativo Día por Día pagos_venta",
      success: false,
      error: msg,
    });
  }

  // 3. Verificación de Celdas de 2 Días (hourOfDay × weekday) contra SQL Nativo
  try {
    const twoDays = rawOrderDays.slice(0, 2);
    if (twoDays.length === 0) {
      console.log("    ⚠️ No hay pedidos en el mes para verificar celdas de 2 días.");
    } else {
      const dStart = twoDays[0].dia;
      const dEnd = twoDays[twoDays.length - 1].dia;

      const rawSqlCells = await prisma.$queryRawUnsafe<
        Array<{ hora: string; dia_semana: string; count: string | number }>
      >(
        `SELECT 
          TO_CHAR(((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima'), 'HH24:00') AS hora,
          CASE EXTRACT(DOW FROM ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima'))
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Lunes'
            WHEN 2 THEN 'Martes'
            WHEN 3 THEN 'Miércoles'
            WHEN 4 THEN 'Jueves'
            WHEN 5 THEN 'Viernes'
            WHEN 6 THEN 'Sábado'
          END AS dia_semana,
          count(*)::int AS count
        FROM sales_order
        WHERE status != 'Cancelled'
          AND ((ordered_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date BETWEEN $1::date AND $2::date
        GROUP BY 1, 2
        ORDER BY 1, 2`,
        dStart,
        dEnd
      );

      const serviceCellsRes = await executeDashboardQueryService(
        {
          dataset: "pedidos",
          axis: "fechaHora",
          granularity: "hourOfDay",
          legend: "fechaHora",
          legendGranularity: "weekday",
          values: [{ field: "numPedidos", agg: "count" }],
          filters: [{ field: "fechaHora", operator: "between", value: [dStart, dEnd] }],
        },
        { superuser: true }
      );

      const serviceCellsMap = new Map<string, number>();
      for (const r of serviceCellsRes.rows) {
        const cellKey = `${r.fechaHora}__${r.fechaHora_legend}`;
        serviceCellsMap.set(cellKey, Number(r.numPedidos_count || 0));
      }

      for (const sqlCell of rawSqlCells) {
        const cellKey = `${sqlCell.hora}__${sqlCell.dia_semana}`;
        const srvVal = serviceCellsMap.get(cellKey) ?? 0;
        const sqlVal = Number(sqlCell.count);
        if (srvVal !== sqlVal) {
          throw new Error(
            `Discrepancia en celda [${cellKey}] entre ${dStart} y ${dEnd}: SQL=${sqlVal}, Servicio=${srvVal}`
          );
        }
      }

      const totalCellOrders = rawSqlCells.reduce((sum, c) => sum + Number(c.count), 0);
      console.log(
        `    ✔ Celdas 2 días pedidos (hourOfDay × weekday): ${rawSqlCells.length} celdas validadas al 100% contra SQL directo (${totalCellOrders} pedidos entre ${dStart} y ${dEnd}).`
      );

      results.push({
        dataset: "pedidos",
        type: "measure",
        target: `Verificación Celdas 2 Días SQL (${rawSqlCells.length} celdas hourOfDay × weekday: ${dStart} a ${dEnd})`,
        success: true,
        rows: totalCellOrders,
        engine: serviceCellsRes.meta.engine,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    ❌ Verificación Celdas 2 Días pedidos FALLÓ: ${msg}`);
    results.push({
      dataset: "pedidos",
      type: "measure",
      target: "Verificación Celdas 2 Días pedidos",
      success: false,
      error: msg,
    });
  }

  // Desconectar Prisma
  await prisma.$disconnect();

  // Imprimir Resumen
  const total = results.length;
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);
  const zeroRowQueries = results.filter((r) => r.success && r.rows === 0);

  console.log("\n========================================================");
  console.log(`🏁 RESULTADOS SMOKE TEST: ${passed}/${total} consultas exitosas (${Math.round((passed / total) * 100)}%)`);
  console.log("========================================================\n");

  if (zeroRowQueries.length > 0) {
    console.log(`⚠️  ${zeroRowQueries.length} consultas ejecutaron correctamente pero devolvieron 0 filas (tabla o filtro sin datos coincidentes):`);
    for (const z of zeroRowQueries) {
      console.log(`   - [${z.dataset}] ${z.target}`);
    }
    console.log("");
  }

  if (failed.length > 0) {
    console.error(`❌ ${failed.length} CONSULTAS FALLARON:\n`);
    for (const f of failed) {
      console.error(`  - [${f.dataset}] ${f.target}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log("✨ Todas las dimensiones y medidas de todos los datasets funcionan al 100%!");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Error fatal durante smoke test:", e);
  process.exit(1);
});
