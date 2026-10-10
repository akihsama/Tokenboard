import Sidebar from "@/components/web/Sidebar";
import { ensureReady } from "@/lib/ready";

export default function WebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Make sure tables exist before any page queries them.
  ensureReady();
  return <Sidebar>{children}</Sidebar>;
}
