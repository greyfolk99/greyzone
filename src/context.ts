import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { GLOBAL_DIR, LOCAL_CONFIG_DIR, LOCAL_CONFIG_FILE } from "./config.js";

export interface GitHubConfig {
  account: string;  // GitHub username for token verification
  repo: string;     // owner/repo format
}

export interface LocalConfig {
  project: string;
  github?: GitHubConfig;
}

/**
 * Find .greyzone/config.yml in cwd or parent directories
 * Returns { configDir, config } or null if not found
 */
function findLocalConfig(): { configDir: string; config: LocalConfig } | null {
  let dir = process.cwd();
  const root = "/";

  while (dir !== root) {
    const configDir = join(dir, LOCAL_CONFIG_DIR);
    const configPath = join(configDir, LOCAL_CONFIG_FILE);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        const parsed = parseYaml(content) as LocalConfig;
        if (parsed.project) {
          return { configDir, config: parsed };
        }
      } catch {
        // ignore read/parse errors
      }
    }
    dir = join(dir, "..");
  }

  return null;
}

/**
 * Get the path to the local .greyzone/ directory
 * Returns the path or null if not found
 */
export function findLocalConfigDir(): string | null {
  const result = findLocalConfig();
  return result?.configDir ?? null;
}

/**
 * Get the local config
 */
export function getLocalConfig(): LocalConfig | null {
  const result = findLocalConfig();
  return result?.config ?? null;
}

/**
 * Get the base directory for storing data (local or global)
 */
export function getBaseDir(global: boolean): string {
  if (global) {
    return GLOBAL_DIR;
  }
  const localDir = findLocalConfigDir();
  if (!localDir) {
    throw new Error("No .greyzone/config.yml found. Run 'gz init <project>' first.");
  }
  return localDir;
}

/**
 * Get project name from local config
 */
export function getProject(): string | null {
  const config = getLocalConfig();
  return config?.project ?? null;
}

/**
 * Get the profile directory path
 */
export function getProfileDir(global: boolean, profile: string): string {
  const baseDir = getBaseDir(global);
  return join(baseDir, profile);
}

/**
 * Get the store.db path
 */
export function getStoreDbPath(global: boolean, profile: string): string {
  return join(getProfileDir(global, profile), "store.db");
}

/**
 * Get the locked.db path
 */
export function getLockedDbPath(global: boolean, profile: string): string {
  return join(getProfileDir(global, profile), "locked.db");
}

/**
 * Check if locked.db exists
 */
export function lockedDbExists(global: boolean, profile: string): boolean {
  try {
    return existsSync(getLockedDbPath(global, profile));
  } catch {
    return false;
  }
}

/**
 * Check if store.db exists
 */
export function storeDbExists(global: boolean, profile: string): boolean {
  try {
    return existsSync(getStoreDbPath(global, profile));
  } catch {
    return false;
  }
}

/**
 * List all profiles in a directory
 */
export function listProfiles(global: boolean): string[] {
  try {
    const baseDir = getBaseDir(global);
    if (!existsSync(baseDir)) {
      return [];
    }

    const entries = readdirSync(baseDir);
    const profiles: string[] = [];

    for (const entry of entries) {
      // Skip config files
      if (entry === LOCAL_CONFIG_FILE || entry === "config.yml" || entry === "master.key" || entry.startsWith(".")) {
        continue;
      }

      const path = join(baseDir, entry);
      if (statSync(path).isDirectory()) {
        profiles.push(entry);
      }
    }

    return profiles.sort();
  } catch {
    return [];
  }
}

/**
 * Initialize local .greyzone/config.yml in current directory
 */
export function initLocalConfig(project: string): void {
  const configDir = join(process.cwd(), LOCAL_CONFIG_DIR);
  const configPath = join(configDir, LOCAL_CONFIG_FILE);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config: LocalConfig = { project };
  writeFileSync(configPath, stringifyYaml(config));
}

/**
 * Update local .greyzone/config.yml with new values
 */
export function updateLocalConfig(updates: Partial<LocalConfig>): void {
  const configDir = findLocalConfigDir();
  if (!configDir) {
    throw new Error("No .greyzone/config.yml found");
  }

  const configPath = join(configDir, LOCAL_CONFIG_FILE);
  const current = getLocalConfig() ?? { project: "" };
  const updated = { ...current, ...updates };

  writeFileSync(configPath, stringifyYaml(updated));
}

/**
 * Get global config (github settings for global scope)
 */
export function getGlobalConfig(): { github?: GitHubConfig } | null {
  const configPath = join(GLOBAL_DIR, LOCAL_CONFIG_FILE);
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return parseYaml(content) as { github?: GitHubConfig };
  } catch {
    return null;
  }
}

/**
 * Update global config
 */
export function updateGlobalConfig(updates: { github?: GitHubConfig }): void {
  if (!existsSync(GLOBAL_DIR)) {
    mkdirSync(GLOBAL_DIR, { recursive: true, mode: 0o700 });
  }

  const configPath = join(GLOBAL_DIR, LOCAL_CONFIG_FILE);
  const current = getGlobalConfig() ?? {};
  const updated = { ...current, ...updates };

  writeFileSync(configPath, stringifyYaml(updated));
}
