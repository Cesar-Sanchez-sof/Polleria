import { ExpenseCategory } from "@prisma/client";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  CasualStaff: "Personal eventual",
  EventServices: "Servicios eventuales",
  TransportAndDelivery: "Transporte y delivery",
  CleaningSupplies: "Suministros de limpieza",
  OtherMinorExpenses: "Otros gastos menores",
};
