import type Database from "better-sqlite3-multiple-ciphers";
import { getDatabase } from "./init.js";
import { DEFAULT_PROFILE } from "../config.js";
import { lockedDbExists, storeDbExists } from "../context.js";

export interface EnvEntry {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  timestamp: string;
  action: string;
  key: string;
  old_value: string | null;
  new_value: string | null;
}

export class EnvStore {
  private db: Database.Database;
  private global: boolean;
  private profile: string;
  private isLocked: boolean;

  constructor(global: boolean, profile: string = DEFAULT_PROFILE, isLocked: boolean = false) {
    this.global = global;
    this.profile = profile;
    this.isLocked = isLocked;
    this.db = getDatabase(global, profile, isLocked);
  }

  set(key: string, value: string): void {
    const existing = this.get(key);

    if (existing !== null) {
      // Update existing
      this.db
        .prepare(
          `UPDATE env SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`
        )
        .run(value, key);
    } else {
      // Insert new
      this.db.prepare(`INSERT INTO env (key, value) VALUES (?, ?)`).run(key, value);
    }

    // Log history
    this.db
      .prepare(
        `INSERT INTO history (action, key, old_value, new_value) VALUES (?, ?, ?, ?)`
      )
      .run("set", key, existing, value);
  }

  get(key: string): string | null {
    const row = this.db
      .prepare(`SELECT value FROM env WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  /**
   * Get value with hierarchy fallback:
   * 1. local locked profile
   * 2. local locked default (if profile != default)
   * 3. global locked profile
   * 4. global locked default (if profile != default)
   * 5. local user profile
   * 6. local user default (if profile != default)
   * 7. global user profile
   * 8. global user default (if profile != default)
   */
  getWithFallback(key: string): string | null {
    const stores: Array<{ global: boolean; profile: string; isLocked: boolean }> = [];

    // Locked first (higher priority)
    // 1. local locked profile
    if (!this.global) {
      stores.push({ global: false, profile: this.profile, isLocked: true });
      // 2. local locked default
      if (this.profile !== DEFAULT_PROFILE) {
        stores.push({ global: false, profile: DEFAULT_PROFILE, isLocked: true });
      }
    }
    // 3. global locked profile
    stores.push({ global: true, profile: this.profile, isLocked: true });
    // 4. global locked default
    if (this.profile !== DEFAULT_PROFILE) {
      stores.push({ global: true, profile: DEFAULT_PROFILE, isLocked: true });
    }

    // User stores (lower priority)
    // 5. local user profile
    if (!this.global) {
      stores.push({ global: false, profile: this.profile, isLocked: false });
      // 6. local user default
      if (this.profile !== DEFAULT_PROFILE) {
        stores.push({ global: false, profile: DEFAULT_PROFILE, isLocked: false });
      }
    }
    // 7. global user profile
    stores.push({ global: true, profile: this.profile, isLocked: false });
    // 8. global user default
    if (this.profile !== DEFAULT_PROFILE) {
      stores.push({ global: true, profile: DEFAULT_PROFILE, isLocked: false });
    }

    for (const { global, profile, isLocked } of stores) {
      // Check if DB exists before trying to open
      const exists = isLocked
        ? lockedDbExists(global, profile)
        : storeDbExists(global, profile);
      if (!exists) continue;

      try {
        const store = new EnvStore(global, profile, isLocked);
        const value = store.get(key);
        store.close();
        if (value !== null) {
          return value;
        }
      } catch {
        // DB not accessible, continue to next
      }
    }

    return null;
  }

  list(): EnvEntry[] {
    return this.db.prepare(`SELECT * FROM env ORDER BY key`).all() as EnvEntry[];
  }

  /**
   * List all entries merged from hierarchy (lowest to highest priority)
   */
  listMerged(): EnvEntry[] {
    const entries = new Map<string, EnvEntry>();

    // Build stores in reverse priority order (lowest first, will be overwritten)
    const stores: Array<{ global: boolean; profile: string; isLocked: boolean }> = [];

    // Global user default (lowest)
    if (this.profile !== DEFAULT_PROFILE) {
      stores.push({ global: true, profile: DEFAULT_PROFILE, isLocked: false });
    }
    // Global user profile
    stores.push({ global: true, profile: this.profile, isLocked: false });

    // Local user (if not global scope)
    if (!this.global) {
      if (this.profile !== DEFAULT_PROFILE) {
        stores.push({ global: false, profile: DEFAULT_PROFILE, isLocked: false });
      }
      stores.push({ global: false, profile: this.profile, isLocked: false });
    }

    // Global locked
    if (this.profile !== DEFAULT_PROFILE) {
      stores.push({ global: true, profile: DEFAULT_PROFILE, isLocked: true });
    }
    stores.push({ global: true, profile: this.profile, isLocked: true });

    // Local locked (highest, if not global scope)
    if (!this.global) {
      if (this.profile !== DEFAULT_PROFILE) {
        stores.push({ global: false, profile: DEFAULT_PROFILE, isLocked: true });
      }
      stores.push({ global: false, profile: this.profile, isLocked: true });
    }

    for (const { global, profile, isLocked } of stores) {
      // Check if DB exists before trying to open
      const exists = isLocked
        ? lockedDbExists(global, profile)
        : storeDbExists(global, profile);
      if (!exists) continue;

      try {
        const store = new EnvStore(global, profile, isLocked);
        for (const entry of store.list()) {
          entries.set(entry.key, entry);
        }
        store.close();
      } catch {
        // DB not accessible, continue to next
      }
    }

    return Array.from(entries.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
  }

  delete(key: string): boolean {
    const existing = this.get(key);
    if (existing === null) {
      return false;
    }

    this.db.prepare(`DELETE FROM env WHERE key = ?`).run(key);

    // Log history
    this.db
      .prepare(
        `INSERT INTO history (action, key, old_value, new_value) VALUES (?, ?, ?, ?)`
      )
      .run("delete", key, existing, null);

    return true;
  }

  getHistory(key?: string): HistoryEntry[] {
    if (key) {
      return this.db
        .prepare(`SELECT * FROM history WHERE key = ? ORDER BY timestamp DESC`)
        .all(key) as HistoryEntry[];
    }
    return this.db
      .prepare(`SELECT * FROM history ORDER BY timestamp DESC`)
      .all() as HistoryEntry[];
  }

  rollback(target: string | number): void {
    let entries: HistoryEntry[];

    if (typeof target === "number") {
      // Rollback N steps
      const steps = Math.abs(target);
      entries = this.db
        .prepare(`SELECT * FROM history ORDER BY timestamp DESC LIMIT ?`)
        .all(steps) as HistoryEntry[];
    } else {
      // Rollback to datetime
      entries = this.db
        .prepare(
          `SELECT * FROM history WHERE timestamp > ? ORDER BY timestamp DESC`
        )
        .all(target) as HistoryEntry[];
    }

    // Apply rollback in reverse order
    for (const entry of entries.reverse()) {
      if (entry.action === "set") {
        if (entry.old_value === null) {
          // Was an insert, delete it
          this.db.prepare(`DELETE FROM env WHERE key = ?`).run(entry.key);
        } else {
          // Was an update, restore old value
          this.db
            .prepare(
              `UPDATE env SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`
            )
            .run(entry.old_value, entry.key);
        }
      } else if (entry.action === "delete") {
        // Restore deleted entry
        if (entry.old_value !== null) {
          this.db
            .prepare(`INSERT OR REPLACE INTO env (key, value) VALUES (?, ?)`)
            .run(entry.key, entry.old_value);
        }
      }
    }

    // Log rollback action
    this.db
      .prepare(
        `INSERT INTO history (action, key, old_value, new_value) VALUES (?, ?, ?, ?)`
      )
      .run("rollback", `rollback:${target}`, null, null);
  }

  diff(dt1: string, dt2: string): HistoryEntry[] {
    return this.db
      .prepare(
        `SELECT * FROM history WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp`
      )
      .all(dt1, dt2) as HistoryEntry[];
  }

  close(): void {
    this.db.close();
  }
}
