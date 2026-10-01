const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '_prisma%' ORDER BY 1`
  );
  console.log(
    "TABLES:",
    tables.map((t) => t.table_name).join(", ")
  );

  const customers = await prisma.customer.count();
  const dishes = await prisma.dish.count();
  const tablesCount = await prisma.diningTable.count();
  const payments = await prisma.paymentType.count();
  const accounts = await prisma.accountingAccount.count();
  const suppliers = await prisma.supplier.count();
  const orders = await prisma.salesOrder.count();
  console.log({ customers, dishes, tablesCount, payments, accounts, suppliers, orders });

  const sample = await prisma.customer.findFirst();
  console.log("sample customer:", sample);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
