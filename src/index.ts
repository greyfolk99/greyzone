// Greyzone - Secure environment variable manager with MCP integration

export { EnvStore } from "./db/operations.js";
export type { EnvEntry, HistoryEntry } from "./db/operations.js";
export {
  findLocalConfigDir,
  getLocalConfig,
  initLocalConfig,
  getGlobalConfig,
  listProfiles,
  getBaseDir,
  getProfileDir,
  getStoreDbPath,
  getLockedDbPath,
  lockedDbExists,
  storeDbExists,
} from "./context.js";
export type { LocalConfig, GitHubConfig } from "./context.js";
export {
  GLOBAL_DIR,
  MASTER_KEY_FILE,
  DEFAULT_PROFILE,
  LOCAL_CONFIG_DIR,
  LOCAL_CONFIG_FILE,
  ensureGlobalDir,
} from "./config.js";
