import { EnvStore, EnvEntry, HistoryEntry } from "../db/operations.js";
import { lockedDbExists, storeDbExists, listProfiles } from "../context.js";
import { DEFAULT_PROFILE } from "../config.js";

export interface SetEnvResult {
  success: boolean;
  error?: string;
  scope: string;
}

export interface GetEnvResult {
  value: string | null;
  found: boolean;
}

export interface DeleteEnvResult {
  deleted: boolean;
}

export function setEnv(
  global: boolean,
  profile: string,
  key: string,
  value: string
): SetEnvResult {
  const scope = global ? `[global/${profile}]` : `[local/${profile}]`;

  // Check if key exists in any locked store in the hierarchy
  // This prevents setting a user value that would be shadowed by a locked value
  const lockedStores: Array<{ global: boolean; profile: string }> = [];

  // Local locked (if not global scope)
  if (!global) {
    lockedStores.push({ global: false, profile });
    if (profile !== DEFAULT_PROFILE) {
      lockedStores.push({ global: false, profile: DEFAULT_PROFILE });
    }
  }
  // Global locked
  lockedStores.push({ global: true, profile });
  if (profile !== DEFAULT_PROFILE) {
    lockedStores.push({ global: true, profile: DEFAULT_PROFILE });
  }

  for (const { global: g, profile: p } of lockedStores) {
    if (lockedDbExists(g, p)) {
      const lockedStore = new EnvStore(g, p, true);
      const lockedValue = lockedStore.get(key);
      lockedStore.close();

      if (lockedValue !== null) {
        const lockedScope = g ? `global/${p}` : `local/${p}`;
        return {
          success: false,
          error: `Key '${key}' is locked in [${lockedScope}]. Use 'sudo gz set --locked' to modify.`,
          scope,
        };
      }
    }
  }

  const store = new EnvStore(global, profile);
  store.set(key, value);
  store.close();

  return { success: true, scope };
}

export function getEnv(global: boolean, profile: string, key: string): GetEnvResult {
  const store = new EnvStore(global, profile);
  const value = store.getWithFallback(key);
  store.close();

  return { value, found: value !== null };
}

export function listEnv(global: boolean, profile: string = DEFAULT_PROFILE): EnvEntry[] {
  const store = new EnvStore(global, profile);
  const entries = store.listMerged();
  store.close();
  return entries;
}

export function deleteEnv(global: boolean, profile: string, key: string): DeleteEnvResult {
  const store = new EnvStore(global, profile);
  const deleted = store.delete(key);
  store.close();
  return { deleted };
}

export interface HistoryEntryWithSource extends HistoryEntry {
  isLocked: boolean;
  profile: string;
}

export function getHistory(
  global: boolean,
  profile: string,
  key?: string
): HistoryEntryWithSource[] {
  const results: HistoryEntryWithSource[] = [];

  // Get from store.db
  if (storeDbExists(global, profile)) {
    const store = new EnvStore(global, profile, false);
    const history = store.getHistory(key);
    store.close();
    results.push(...history.map(h => ({ ...h, isLocked: false, profile })));
  }

  // Get from locked.db
  if (lockedDbExists(global, profile)) {
    const lockedStore = new EnvStore(global, profile, true);
    const lockedHistory = lockedStore.getHistory(key);
    lockedStore.close();
    results.push(...lockedHistory.map(h => ({ ...h, isLocked: true, profile })));
  }

  // Sort by timestamp descending
  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getAllHistory(
  global: boolean,
  key?: string
): HistoryEntryWithSource[] {
  const profiles = listProfiles(global);
  const results: HistoryEntryWithSource[] = [];

  for (const profile of profiles) {
    results.push(...getHistory(global, profile, key));
  }

  // Sort by timestamp descending
  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function rollback(
  global: boolean,
  profile: string,
  target: string | number
): void {
  const store = new EnvStore(global, profile);
  const parsed = typeof target === "string" && target.startsWith("-")
    ? parseInt(target, 10)
    : target;
  store.rollback(parsed);
  store.close();
}

export function diff(
  global: boolean,
  profile: string,
  dt1: string,
  dt2: string
): HistoryEntryWithSource[] {
  const results: HistoryEntryWithSource[] = [];

  // Get from store.db
  if (storeDbExists(global, profile)) {
    const store = new EnvStore(global, profile, false);
    const entries = store.diff(dt1, dt2);
    store.close();
    results.push(...entries.map(h => ({ ...h, isLocked: false, profile })));
  }

  // Get from locked.db
  if (lockedDbExists(global, profile)) {
    const lockedStore = new EnvStore(global, profile, true);
    const lockedEntries = lockedStore.diff(dt1, dt2);
    lockedStore.close();
    results.push(...lockedEntries.map(h => ({ ...h, isLocked: true, profile })));
  }

  // Sort by timestamp ascending
  return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
