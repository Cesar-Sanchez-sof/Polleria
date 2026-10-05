

import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
import { Calculator } from "lucide-react";

export const metadata = {
  title: "Guía Contable",
  description: "Reglas y procesos de contabilidad para Pollería",
};

export default function AccountingGuidePage() {
  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
      <ModuleHeader
        title="Guía Contable"
        subtitle="Reglas y procesos contables para la Pollería"
        icon={Calculator}
        iconClassName="bg-indigo-100 text-indigo-700"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
            <section>
              <h2 className="text-2xl font-semibold mb-2">Conceptos básicos</h2>
              <p className="mb-2">
                Debe = qué recibí / qué se reconoce <br />
                Haber = qué entregué / de dónde salió
              </p>
              <h3 className="text-lg font-semibold mb-2">Ejemplo: Cuenta 10 — Efectivo y equivalentes de efectivo</h3>
              <p className="mb-2">
                Debe
                La cuenta es debitada <br />
                Haber
                La cuenta es acreditada <br />
              </p>
              <p className="mb-2">
                Es debitada por (DEBE):

                Ingreso de dinero en efectivo.
                Cobros a clientes.
                Depósitos recibidos.
              </p>
              <p className="mb-2">
                Es acreditada por (HABER):

                Pagos realizados en efectivo.
                Retiros de dinero.
                Transferencias o desembolsos.
              </p>
              <h3 className="text-lg font-semibold mb-2">La idea clave es:</h3>
              <p className="mb-2">
                “Es debitada por” → ¿qué operaciones aumentan/disminuyen la cuenta por el DEBE?
                <br />
                “Es acreditada por” → ¿qué operaciones se registran por el HABER?
              </p>
            </section>
            <section>
              <h2 className="text-2xl font-semibold mb-4">Reglas actuales para crear asientos contables</h2>
              <h3 className="text-xl font-semibold mt-4 mb-2">Ventas</h3>
              <ol className="list-decimal pl-6 space-y-1">
                <li>
                  <strong>Asiento de Provisión de la Venta (Facturación)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121) — Por el precio de venta total (incluido IGV).</li>
                    <li><strong>HABER</strong>: 40 Tributos, contraprestaciones y aportes al sistema público de pensiones y de salud por pagar (Subcuenta 40111 IGV – Cuenta propia) — Por el IGV generado en la venta (18%).</li>
                    <li><strong>HABER</strong>: 70 Ventas (Subcuenta 701 Mercaderías, 702 Productos terminados o 703 Servicios terminados) — Por el valor neto de la venta (sin impuestos).</li>
                  </ul>
                </li>
                <li>
                  <strong>Asiento del Costo de Ventas (Salida de Almacén)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 69 Costo de ventas (Subcuenta 691 Mercaderías o 692 Productos terminados) — Por el costo.</li>
                    <li><strong>HABER</strong>: 20 Inventario (Mercaderías) — Por el costo del bien vendido.</li>
                  </ul>
                </li>
                <li>
                  <strong>Asiento de Cobro (Cancelación de la Venta)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 10 Caja/Bancos (Subcuenta 101/104) — Por el total recibido.</li>
                    <li><strong>HABER</strong>: 12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121) — Por el total cobrado.</li>
                  </ul>
                </li>
              </ol>
              <h3 className="text-xl font-semibold mt-4 mb-2">Compras</h3>
              <ol className="list-decimal pl-6 space-y-1">
                <li>
                  <strong>Asiento de Provisión de la Compra (Factura del Proveedor)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 60 Compras (Subcuenta 601 Mercaderías, 602 Materias primas, etc.) — Por el valor neto de la compra (sin impuestos).</li>
                    <li><strong>DEBE</strong>: 40 Tributos, contraprestaciones y aportes al sistema público de pensiones y de salud por pagar (Subcuenta 40111 IGV – Cuenta propia) — Por el IGV generado en la compra (18%).</li>
                    <li><strong>HABER</strong>: 42 Cuentas por pagar comerciales – Terceros (Subcuenta 421 Facturas, boletas y otros comprobantes por pagar) — Por el precio total a pagar al proveedor.</li>
                  </ul>
                </li>
                <li>
                  <strong>Asiento de Destino (Ingreso al Almacén)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 20 Mercaderías (o 24 Materias primas, 25 Suministros) — Por el ingreso físico de los bienes al inventario.</li>
                    <li><strong>HABER</strong>: 61 Variación de inventarios (Subcuenta 611 Mercaderías, 612 Materias primas) — Como cuenta correctora / contrapartida del costo asignado a inventarios.</li>
                  </ul>
                </li>
                <li>
                  <strong>Asiento de Pago (Cancelación al Proveedor)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 42 Cuentas por pagar comerciales – Terceros (Subcuenta 421) — Por la cancelación total o parcial del comprobante.</li>
                    <li><strong>HABER</strong>: 10 Efectivo y equivalentes de efectivo (Subcuenta 104 Cuentas corrientes o 101 Caja) — Por la salida de efectivo o transferencia bancaria.</li>
                  </ul>
                </li>
              </ol>
            </section>
            <section className="">
              <h3 className="text-xl font-semibold mt-4 mb-2">Notas de Crédito sobre Ventas (Devoluciones o Descuentos)</h3>
              <ol className="list-decimal pl-6 space-y-1">
                <li>
                  <strong>Asiento de Provisión de la Nota de Crédito</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 74 Descuentos, rebajas y bonificaciones concedidos (o 709 Devoluciones sobre ventas) — Por el valor neto del descuento o devolución.</li>
                    <li><strong>DEBE</strong>: 40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV – Cuenta propia) — Por el ajuste/crédito del IGV (18%).</li>
                    <li><strong>HABER</strong>: 12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121 Facturas por cobrar) — Por el monto total de la Nota de Crédito.</li>
                  </ul>
                </li>
                <li>
                  <strong>Asiento de Reingreso al Almacén (Solo si hubo devolución física de mercadería)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 20 Mercaderías (Subcuenta 201) — Por el costo de adquisición de los bienes devueltos.</li>
                    <li><strong>HABER</strong>: 69 Costo de ventas (Subcuenta 691 Mercaderías) — Extornando / reduciendo el costo de ventas previamente reconocido.</li>
                  </ul>
                </li>
              </ol>
            </section>
            <section className="">
              <h3 className="text-xl font-semibold mt-4 mb-2">Venta con Anticipo de Clientes</h3>
              <ol className="list-decimal pl-6 space-y-1">
                <li>
                  <strong>Asiento de Cobro del Anticipo (Emisión del Comprobante de Anticipo)</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 10 Efectivo y equivalentes de efectivo (Subcuenta 101 / 104) — Por el dinero total recibido.</li>
                    <li><strong>HABER</strong>: 40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV – Cuenta propia) — Por el IGV generado en el anticipo.</li>
                    <li><strong>HABER</strong>: 12 Cuentas por cobrar comerciales – Terceros (Subcuenta 122 Anticipos de clientes) — Por el valor neto del adelanto.</li>
                  </ul>
                </li>
                <li>
                  <strong>Asiento de Aplicación del Anticipo en la Factura Final</strong>:
                  <ul className="list-disc pl-6 ml-4">
                    <li><strong>DEBE</strong>: 12 Cuentas por cobrar comerciales – Terceros (Subcuenta 122 Anticipos de clientes) — Por el valor neto anticipado previamente.</li>
                    <li><strong>DEBE</strong>: 12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121 Facturas por cobrar) — Por el saldo neto pendiente de cobro (si aplica).</li>
                    <li><strong>DEBE</strong>: 40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV) — Por el IGV correspondiente al saldo pendiente.</li>
                    <li><strong>HABER</strong>: 70 Ventas (Subcuenta 701 Mercaderías) — Por el valor de venta total del bien o servicio.</li>
                    <li><strong>HABER</strong>: 40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV) — Por el IGV total de la operación.</li>
                  </ul>
                </li>
              </ol>
            </section>
          </Card>


        </div>
      </main>
    </div>
  );
}
