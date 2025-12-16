import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { EnvStore } from "../db/operations.js";
import { DEFAULT_PROFILE } from "../config.js";
import { maskValue } from "../utils/mask.js";

export async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

export function importEnvFile(
  filePath: string,
  global: boolean,
  profile: string = DEFAULT_PROFILE,
  isLocked: boolean = false,
  keys?: string[]
): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const store = new EnvStore(global, profile, isLocked);
  const keySet = keys ? new Set(keys) : null;

  let imported = 0;
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Parse KEY=value
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, eqIndex).trim();

    // Skip if keys filter is set and key is not in the list
    if (keySet && !keySet.has(key)) {
      continue;
    }

    let value = trimmed.substring(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    store.set(key, value);
    imported++;
  }

  store.close();

  const scope = global ? `[global/${profile}${isLocked ? ":locked" : ""}]` : `[local/${profile}${isLocked ? ":locked" : ""}]`;
  console.log(`${scope} Imported ${imported} variables from ${filePath}`);
}

export function exportEnv(
  global: boolean,
  profile: string = DEFAULT_PROFILE,
  outputPath?: string,
  isLocked: boolean = false,
  keys?: string[],
  masked: boolean = false
): void {
  const store = new EnvStore(global, profile, isLocked);
  let entries = isLocked ? store.list() : store.listMerged();
  store.close();

  // Filter by keys if specified
  if (keys && keys.length > 0) {
    const keySet = new Set(keys);
    entries = entries.filter((e) => keySet.has(e.key));
  }

  const lines: string[] = [];
  for (const entry of entries) {
    const value = masked ? maskValue(entry.value) : entry.value;
    // Escape single quotes for shell
    const escaped = value.replace(/'/g, "'\\''");
    lines.push(`export ${entry.key}='${escaped}'`);
  }

  const content = lines.join("\n") + "\n";

  if (outputPath) {
    writeFileSync(outputPath, content);
    console.log(`Exported ${entries.length} variables to ${outputPath}`);
  } else {
    process.stdout.write(content);
  }
}
