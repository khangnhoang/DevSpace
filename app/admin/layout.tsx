import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth.server";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getCurrentUser())) redirect("/login");
  if ("error" in (await requireAdmin())) redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
