import MobileTabBar from "@/components/mobile/TabBar";
import { ensureReady } from "@/lib/ready";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  ensureReady();
  return (
    <div className="m-shell">
      {children}
      <MobileTabBar />
    </div>
  );
}
