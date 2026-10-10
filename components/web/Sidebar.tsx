"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV = [
  { href: "/", label: "总览", icon: IconGrid },
  { href: "/keys", label: "API Keys", icon: IconKey },
  { href: "/providers", label: "平台模板", icon: IconTemplate },
  { href: "/logs", label: "同步日志", icon: IconList },
  { href: "/settings", label: "设置", icon: IconGear },
];

export default function Sidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <span>TokenBoard</span>
        </div>
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
            >
              <item.icon />
              {item.label}
            </Link>
          );
        })}
        <div className="sidebar-foot">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <span>主题</span>
            <ThemeToggle />
          </div>
          <div>开源 · GPL-3.0</div>
          <div className="mt-8">
            <Link href="/m" className="muted">
              切换到移动版 →
            </Link>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

/* Inline monochrome icons */
function base(props: React.SVGProps<SVGSVGElement>) {
  return {
    className: "nav-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}
function IconGrid() {
  return (
    <svg {...base({})}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg {...base({})}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.5 12.5 21 2" />
      <path d="M17 6l3 3" />
    </svg>
  );
}
function IconTemplate() {
  return (
    <svg {...base({})}>
      <path d="M4 5h16M4 12h10M4 19h7" />
      <circle cx="18" cy="19" r="3" />
    </svg>
  );
}
function IconList() {
  return (
    <svg {...base({})}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg {...base({})}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}
