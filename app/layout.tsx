import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "TokenBoard · API Token 用量看板",
  description:
    "开源的大模型 API Token 用量与成本统计看板，支持 OpenAI、Anthropic、DeepSeek、OpenRouter 及自定义平台模板。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Runs before first paint so the correct theme is already on <html>.
 * Keep this in sync with readStoredMode()/resolveTheme() in
 * components/theme/ThemeProvider.tsx.
 */
const THEME_BOOTSTRAP = `
(function(){
  try {
    var key = "tokenboard-theme";
    var mode = localStorage.getItem(key);
    if (mode !== "light" && mode !== "dark" && mode !== "system") mode = "light";
    var resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
