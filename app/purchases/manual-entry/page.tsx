import { redirect } from "next/navigation";

export default function ManualEntryPage() {
  redirect("/purchases/purchase-without-voucher");
}
