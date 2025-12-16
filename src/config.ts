import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

// Global config: ~/.greyzone/
export const GLOBAL_DIR = join(homedir(), ".greyzone");
export const MASTER_KEY_FILE = join(GLOBAL_DIR, "master.key");

// Default profile name
export const DEFAULT_PROFILE = "default";

// Local config directory and file names
export const LOCAL_CONFIG_DIR = ".greyzone";
export const LOCAL_CONFIG_FILE = "config.yml";

export function ensureGlobalDir(): void {
  if (!existsSync(GLOBAL_DIR)) {
    mkdirSync(GLOBAL_DIR, { recursive: true, mode: 0o700 });
  }
}
