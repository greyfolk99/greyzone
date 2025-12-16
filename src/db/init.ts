import Database from "better-sqlite3-multiple-ciphers";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chownSync,
} from "fs";
import { randomBytes } from "crypto";
import { dirname } from "path";
import { execSync } from "child_process";
import { MASTER_KEY_FILE, GLOBAL_DIR, DEFAULT_PROFILE } from "../config.js";
import {
  getStoreDbPath,
  getLockedDbPath,
  getProfileDir,
} from "../context.js";

/**
 * Get the real user's UID/GID when running under sudo
 */
function getRealUser(): { uid: number; gid: number } | null {
  const sudoUser = process.env.SUDO_USER;
  if (!sudoUser) return null;

  try {
    const uid = parseInt(execSync(`id -u ${sudoUser}`, { encoding: "utf-8" }).trim(), 10);
    const gid = parseInt(execSync(`id -g ${sudoUser}`, { encoding: "utf-8" }).trim(), 10);
    return { uid, gid };
  } catch {
    return null;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS env (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL,
  key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
CREATE INDEX IF NOT EXISTS idx_history_key ON history(key);
`;

export function getMasterKey(): string {
  // Ensure ~/.greyzone exists for master.key
  if (!existsSync(GLOBAL_DIR)) {
    mkdirSync(GLOBAL_DIR, { recursive: true, mode: 0o700 });
  }

  if (existsSync(MASTER_KEY_FILE)) {
    return readFileSync(MASTER_KEY_FILE, "utf-8").trim();
  }

  // Generate new master key
  const key = randomBytes(32).toString("hex");
  writeFileSync(MASTER_KEY_FILE, key, { mode: 0o400 });
  return key;
}

export function initDatabase(dbPath: string): Database.Database {
  const dir = dirname(dbPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 });

    // If running under sudo, chown directory to the real user
    const realUser = getRealUser();
    if (realUser) {
      chownSync(dir, realUser.uid, realUser.gid);
    }
  }

  const key = getMasterKey();
  const db = new Database(dbPath);

  // Enable SQLCipher encryption
  db.pragma(`cipher = 'sqlcipher'`);
  db.pragma(`key = '${key}'`);

  db.exec(SCHEMA);

  return db;
}

export function ensureProfileDir(global: boolean, profile: string): void {
  const profileDir = getProfileDir(global, profile);
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true, mode: 0o755 });

    // If running under sudo, chown directory to the real user
    const realUser = getRealUser();
    if (realUser) {
      chownSync(profileDir, realUser.uid, realUser.gid);
    }
  }
}

export function getDatabase(
  global: boolean,
  profile: string = DEFAULT_PROFILE,
  isLocked: boolean = false
): Database.Database {
  ensureProfileDir(global, profile);
  const dbPath = isLocked ? getLockedDbPath(global, profile) : getStoreDbPath(global, profile);
  return initDatabase(dbPath);
}
