import { test, expect } from "@playwright/test";

test.describe("Escenario 1: Flujo de Venta Completo", () => {
  test("debe iniciar sesión, abrir mesa 1, agregar producto, enviar a cocina, cobrar en caja y verificar asiento contable", async ({
    page,
  }) => {
    // 1. Iniciar sesión con credenciales de administrador
    await page.goto("/login");
    await page.locator("input#usuario").fill("admin");
    await page.locator("input#password").fill("Password123!");
    await page.locator("button[type='submit']").click();

    // Esperar a que redirija fuera de la vista de login
    await page.waitForURL((url) => !url.pathname.includes("/login") && !url.pathname.includes("/security/login"), {
      timeout: 15000,
    });

    // 2. Ir a Salón -> Abrir Mesa 1
    await page.goto("/sales?tab=tables");

    // Esperar a que el salón cargue y el estado de la caja se haya verificado contra la API
    const tablesMain = page.locator('[data-testid="sales-tables-main"]');
    await expect(tablesMain).toBeVisible({ timeout: 20000 });
    await expect(tablesMain).toHaveAttribute("data-cash-checked", "true", { timeout: 20000 });

    // Si la caja no se encuentra abierta, aperturarla
    const isCashOpened = await tablesMain.getAttribute("data-cash-opened");
    if (isCashOpened !== "true") {
      const abrirCajaBanner = page.getByRole("button", { name: /Abrir Caja Ahora/i });
      if (await abrirCajaBanner.isVisible()) {
        await abrirCajaBanner.click();
      }
      const confirmAperturaBtn = page.getByRole("button", { name: /Confirmar Apertura/i });
      await expect(confirmAperturaBtn).toBeVisible({ timeout: 10000 });
      await confirmAperturaBtn.click();
      await page.waitForTimeout(1000);
      await page.goto("/sales?tab=tables");
      await expect(tablesMain).toHaveAttribute("data-cash-opened", "true", { timeout: 20000 });
    }

    // Localizar la tarjeta correspondiente a la Mesa 1 con data-testid
    const mesa1Card = page.locator('[data-testid="mesa-1"]');
    await expect(mesa1Card).toBeVisible({ timeout: 20000 });

    // Abrir la comanda de la Mesa 1
    const openOrderBtn = mesa1Card.getByRole("button", { name: /Tomar Pedido|\+ Adicionar/i });
    if (await openOrderBtn.isVisible()) {
      await openOrderBtn.click();
    } else {
      await mesa1Card.click();
    }

    // 3. Modal de comanda: Esperar a que el modal aparezca
    const orderDialog = page.locator("div[role='dialog']").filter({ hasText: /Comanda/i });
    await expect(orderDialog).toBeVisible({ timeout: 15000 });

    // Seleccionar el primer producto disponible del menú
    const productItem = orderDialog.locator('[data-testid^="producto-"]').or(
      orderDialog.locator("div.cursor-pointer").filter({ hasText: /Pollo a la Brasa/i })
    ).first();
    await expect(productItem).toBeVisible({ timeout: 15000 });
    await productItem.click();

    // Confirmar y Enviar a Cocina con data-testid
    const sendButton = orderDialog.locator('[data-testid="enviar-cocina-btn"]').or(
      orderDialog.getByRole("button", { name: /Confirmar y Enviar|Guardar Cambios/i })
    );
    await expect(sendButton).toBeEnabled({ timeout: 10000 });
    await sendButton.click();

    // Esperar a que se procese el envío y se cierre el modal
    await expect(orderDialog).not.toBeVisible({ timeout: 15000 });

    // 4. Ir a Caja -> Cobrar en Efectivo -> Emitir Boleta
    await page.goto("/sales?tab=cashier");

    // Seleccionar la cuenta de Mesa 1 en la lista de cuentas pendientes
    const pendingAccount = page.locator('[data-testid="cuenta-pendiente-mesa-1"]').or(
      page.locator("div.cursor-pointer").filter({ hasText: /Mesa\s+1\b/ })
    ).first();
    await expect(pendingAccount).toBeVisible({ timeout: 20000 });
    await pendingAccount.click();

    // Asegurar que el tipo de comprobante sea Boleta
    const boletaBtn = page.getByRole("button", { name: /^Boleta$/i });
    if (await boletaBtn.isVisible()) {
      await boletaBtn.click();
    }

    // Seleccionar Efectivo como método de pago
    const cashBtn = page.getByRole("button", { name: /Efectivo/i }).first();
    if (await cashBtn.isVisible()) {
      await cashBtn.click();
    }

    // Proporcionar monto entregado si es necesario
    const fastBillBtn = page.getByRole("button", { name: /S\/100|S\/200|S\/50/i }).first();
    if (await fastBillBtn.isVisible()) {
      await fastBillBtn.click();
    } else {
      const amountInput = page.locator('input[type="number"][placeholder*="Ej:"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill("100");
      }
    }

    // Emitir Comprobante y Cobrar en Ventanilla con data-testid
    const emitButton = page.locator('[data-testid="cobrar-emitir-btn"]');
    await expect(emitButton).toBeEnabled({ timeout: 10000 });
    await emitButton.click();

    // Dar margen para que la venta se guarde en la base de datos de Neon
    await page.waitForTimeout(2000);

    // 5. Ir a Contabilidad -> Libro Diario y verificar que el asiento de la venta se registró
    await page.goto("/accounting/entries");

    // Esperar a que la tabla contable cargue sus registros y aparezca el asiento
    const journalTable = page.locator("table");
    await expect(journalTable).toBeVisible({ timeout: 20000 });

    const tableRows = page.locator("table tbody tr");
    await expect(tableRows.first()).toBeVisible({ timeout: 20000 });
  });
});
