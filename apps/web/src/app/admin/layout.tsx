import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";

// O painel não deve aparecer em buscadores.
export const metadata: Metadata = {
  title: "Painel administrativo",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
