"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: "light",
    label: "日间",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        />
      </svg>
    ),
  },
  {
    mode: "dark",
    label: "夜间",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
        />
      </svg>
    ),
  },
  {
    mode: "system",
    label: "跟随系统",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path strokeLinecap="round" d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (compact) {
    const isDark = resolved === "dark";
    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label={isDark ? "切换到日间主题" : "切换到夜间主题"}
        title={isDark ? "切换到日间主题" : "切换到夜间主题"}
        onClick={() => setMode(isDark ? "light" : "dark")}
      >
        {isDark ? OPTIONS[0].icon : OPTIONS[1].icon}
      </button>
    );
  }

  const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[0];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ display: "inline-flex", width: 14, height: 14 }}>
          {current.icon}
        </span>
        {current.label}
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              role="menuitemradio"
              aria-checked={mode === opt.mode}
              className={mode === opt.mode ? "active" : ""}
              onClick={() => {
                setMode(opt.mode);
                setOpen(false);
              }}
            >
              <span style={{ display: "inline-flex", width: 14, height: 14 }}>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
