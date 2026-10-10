import fs from "node:fs";
import path from "node:path";

import { validateTemplate } from "./schema";
import type { TemplateSpec } from "./types";

/**
 * Built-in templates ship as JSON files in ./templates and are loaded once
 * at boot. They are read-only; the UI can "clone" one into a user template.
 */
const TEMPLATES_DIR = path.join(process.cwd(), "lib", "providers", "templates");

let cache: TemplateSpec[] | null = null;

function loadBuiltins(): TemplateSpec[] {
  const dir = fs.existsSync(TEMPLATES_DIR) ? TEMPLATES_DIR : path.join(__dirname, "templates");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const specs: TemplateSpec[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      specs.push(validateTemplate(raw) as TemplateSpec);
    } catch (err) {
      console.error(`[registry] 内置模板加载失败 ${file}:`, err);
    }
  }
  return specs.sort((a, b) => a.name.localeCompare(b.name));
}

export function builtinTemplates(): TemplateSpec[] {
  if (!cache) cache = loadBuiltins();
  return cache;
}

export function getBuiltin(id: string): TemplateSpec | undefined {
  return builtinTemplates().find((t) => t.id === id);
}

export function clearRegistryCache(): void {
  cache = null;
}
