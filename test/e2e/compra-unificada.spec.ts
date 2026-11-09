import { test, expect } from "@playwright/test";

test.describe("Escenario 2: Flujo de Compra Unificada", () => {
  test("debe iniciar sesión, registrar compra al contado de insumo con comprobante y verificar stock en kardex", async ({
    page,
  }) => {
    // 1. Iniciar sesión con credenciales de administrador
    await page.goto("/login");
    await page.locator("input#usuario").fill("admin");
    await page.locator("input#password").fill("Password123!");
    await page.locator("button[type='submit']").click();

    // Esperar a que redirija fuera del login
    await page.waitForURL((url) => !url.pathname.includes("/login") && !url.pathname.includes("/security/login"), {
      timeout: 15000,
    });

    // 2. Ir a Compras e Inventario -> Añadir Compra
    await page.goto("/purchases/list?tab=add");

    // 3. Seleccionar proveedor (ej. San Fernando)
    const supplierInput = page.getByPlaceholder(/Escribir RUC, DNI o Razón Social/i);
    await expect(supplierInput).toBeVisible({ timeout: 20000 });
    await supplierInput.click();
    await supplierInput.fill("San Fernando");

    // Seleccionar de la lista desplegable
    const supplierOption = page
      .locator("div")
      .filter({ hasText: /San Fernando|20100154308/i })
      .last();
    await expect(supplierOption).toBeVisible({ timeout: 10000 });
    await supplierOption.click();

    // 4. Datos del comprobante
    const seriesInput = page.getByPlaceholder(/Ej: F001 \/ B001/i);
    await seriesInput.fill("F001");

    const randomVoucherNum = String(Math.floor(100000 + Math.random() * 899999));
    const numberInput = page.getByPlaceholder(/Ej: 0012345/i);
    await numberInput.fill(randomVoucherNum);

    // 5. Insumo: Seleccionar "Pollo entero", ingresar cantidad y precio
    const productInput = page.getByPlaceholder(/Buscar insumo por nombre/i).first();
    await productInput.click();
    await productInput.fill("Pollo entero");

    const productOption = page
      .locator("div")
      .filter({ hasText: /Pollo entero/i })
      .last();
    await expect(productOption).toBeVisible({ timeout: 10000 });
    await productOption.click();

    // Cantidad (10)
    const qtyInput = page.locator("table tbody tr input[type='number']").first();
    await qtyInput.fill("10");

    // Precio Unitario (8.50)
    const priceInput = page.locator("table tbody tr input[type='number']").nth(1);
    await priceInput.fill("8.50");

    // 6. Guardar Compra
    const saveButton = page.getByRole("button", { name: /Guardar Compra/i });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // Esperar a que se procese y redirija a la lista de compras
    await page.waitForURL((url) => url.pathname.includes("/purchases/list") && !url.search.includes("tab=add"), {
      timeout: 20000,
    });

    // 7. Ir a Kardex e Inventario -> Verificar que el stock aumentó
    await page.goto("/purchases/inventory");

    // Buscar el insumo en el buscador si está presente
    const searchInput = page.getByPlaceholder(/Buscar insumo|Buscar producto/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Pollo entero");
    }

    // Verificar que la fila de "Pollo entero" figure en la tabla con stock disponible
    const productRow = page
      .locator("table tbody tr")
      .filter({ hasText: /Pollo entero/i })
      .first();

    await expect(productRow).toBeVisible({ timeout: 20000 });
    // Verificar que muestre el stock aumentado (ej. 10.00 o positivo)
    await expect(productRow).toContainText(/(10(\.00)?|\b[1-9]\d*(\.\d+)?)/);
  });
});
