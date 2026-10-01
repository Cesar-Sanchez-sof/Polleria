import { redirect } from "next/navigation";

export default function ListPurchasesPage() {
  redirect("/purchases/supplier-invoices");
}
