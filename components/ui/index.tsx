import Link from "next/link";
import type { ReactNode } from "react";

/** Shared presentational primitives. Intentionally tiny — plain CSS classes. */

export function Card({
  title,
  children,
  className = "",
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="row-between" style={{ marginBottom: 10 }}>
          {title && <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="card">
      <h3 className="card-title">{label}</h3>
      <div className="stat-value num">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Tag({
  children,
  solid = false,
  title,
}: {
  children: ReactNode;
  solid?: boolean;
  title?: string;
}) {
  return (
    <span className={`tag${solid ? " tag-solid" : ""}`} title={title}>
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const cls = status === "ok" ? "" : status === "error" ? "err" : "warn";
  const label = status === "ok" ? "正常" : status === "error" ? "异常" : "未知";
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`dot ${cls}`} />
      <span className="muted fs-12">{label}</span>
    </span>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <div className="muted">{children}</div>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return <div className="banner">{children}</div>;
}

export function LinkButton({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "primary";
}) {
  return (
    <Link
      href={href}
      className={`btn${variant === "primary" ? " btn-primary" : ""}`}
    >
      {children}
    </Link>
  );
}
