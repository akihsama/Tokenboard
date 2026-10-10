"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/m", label: "总览", icon: IconHome },
  { href: "/m/keys", label: "Keys", icon: IconKey },
  { href: "/m/logs", label: "日志", icon: IconList },
  { href: "/m/settings", label: "设置", icon: IconGear },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="m-tabbar">
      {TABS.map((t) => {
        const active =
          t.href === "/m" ? pathname === "/m" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`m-tab${active ? " active" : ""}`}>
            <t.icon />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function wrap(children: React.ReactNode) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
function IconHome() {
  return wrap(<path d="M3 10.5 12 3l9 7.5V21H3z" />);
}
function IconKey() {
  return wrap(
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.5 12.5 21 2M17 6l3 3" />
    </>,
  );
}
function IconList() {
  return wrap(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />);
}
function IconGear() {
  return wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>,
  );
}
