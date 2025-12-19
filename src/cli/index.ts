#!/usr/bin/env node

import { Command } from "commander";
import { EnvStore } from "../db/operations.js";
import {
  initLocalConfig,
  getLocalConfig,
  findLocalConfigDir,
  listProfiles,
} from "../context.js";
import { pushToGitHub } from "./github.js";
import { importEnvFile, exportEnv, confirm } from "./io.js";
import {
  getGitHubConfig,
  setGitHubConfig,
  getGitHubCredentials,
} from "../services/project-config.js";
import {
  setEnv,
  getEnv,
  listEnv,
  deleteEnv,
  getHistory,
  getAllHistory,
  rollback,
  diff,
} from "../services/env.js";
import { DEFAULT_PROFILE } from "../config.js";
import { maskValue } from "../utils/mask.js";

const program = new Command();

program
  .name("gz")
  .description(
`Secure environment variable manager that prevents AI agents from corrupting secrets.

WHY USE THIS?
  AI agents (Claude, Cursor, etc.) often corrupt .env files by overwriting or deleting values.
  Greyzone stores secrets in encrypted SQLite, so AI can read but not accidentally destroy them.
  Use --locked with sudo to store critical secrets that AI cannot modify at all.

QUICK START:
  gz init myproject          # Initialize in current directory
  gz set API_KEY sk-xxx      # Store a secret
  gz get API_KEY             # Retrieve it
  gz list                    # Show all keys
  eval $(gz export)          # Export to shell

LOCKED PROTECTION (AI-proof):
  sudo gz set API_KEY sk-xxx --locked    # AI can read, but cannot modify
  gz get API_KEY                         # Works normally (read-only for AI)

MCP SERVER (for AI agents):
  Add to claude_desktop_config.json:
  { "mcpServers": { "greyzone": { "command": "npx", "args": ["-y", "greyzone", "mcp"], "cwd": "/your/project" }}}
`)
  .version("0.1.0");

// Shared options
interface CommonOptions {
  profile?: string;
  global?: boolean;
  locked?: boolean;
  yes?: boolean;
}

// Resolved context
let resolvedGlobal: boolean = false;
let resolvedProfile: string = DEFAULT_PROFILE;
let resolvedLocked: boolean = false;

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("-g, --global", "Use global scope (~/.greyzone)")
    .option("--profile <profile>", "Use specific profile (default: default)")
    .option("--locked", "Access locked storage (requires sudo for write)")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts() as CommonOptions;
      resolvedGlobal = opts.global ?? false;
      resolvedProfile = opts.profile ?? DEFAULT_PROFILE;
      resolvedLocked = opts.locked ?? false;

      // Check sudo for locked write operations
      // Read operations don't require sudo (locked.db has 644 permission)
      const writeCommands = ["set", "delete", "rollback", "undo", "import"];
      const isWriteCommand = writeCommands.some(c => thisCommand.name() === c);

      if (resolvedLocked && isWriteCommand && process.getuid?.() !== 0) {
        console.error("Error: --locked write operations require sudo");
        process.exit(1);
      }

      // Check local config exists if not global
      if (!resolvedGlobal && !findLocalConfigDir()) {
        console.error("Error: No .greyzone/config.yml found. Run 'gz init <project>' first, or use -g for global.");
        process.exit(1);
      }
    });
}

function addWriteOptions(cmd: Command): Command {
  return addCommonOptions(cmd).option("-y, --yes", "Skip confirmation prompt");
}

function formatScope(global: boolean, profile: string, locked: boolean): string {
  const base = global ? `global/${profile}` : `local/${profile}`;
  return locked ? `${base}:locked` : base;
}

async function confirmWrite(
  action: string,
  key: string,
  value?: string,
  skipConfirm?: boolean
): Promise<boolean> {
  if (skipConfirm) return true;

  const scope = formatScope(resolvedGlobal, resolvedProfile, resolvedLocked);
  const header = resolvedLocked ? "=== Confirm (LOCKED) ===" : "=== Confirm ===";
  const footer = resolvedLocked ? "========================" : "===============";

  console.log(`\n${header}`);
  console.log(`  Action:  ${action}`);
  console.log(`  Scope:   ${scope}`);
  console.log(`  Key:     ${key}`);
  if (value !== undefined) {
    console.log(`  Value:   ${resolvedLocked ? maskValue(value) : value}`);
  }
  console.log(`${footer}\n`);

  return confirm("Proceed?");
}

// === Project Initialization ===

program
  .command("init <project>")
  .description("Initialize .greyzone/ in current directory")
  .action((project: string) => {
    if (findLocalConfigDir()) {
      console.error("Error: .greyzone/config.yml already exists");
      process.exit(1);
    }
    initLocalConfig(project);
    console.log(`Initialized .greyzone/config.yml with project: ${project}`);
  });

program
  .command("current")
  .description("Show current context")
  .option("-g, --global", "Show global context")
  .action((opts: { global?: boolean }) => {
    if (opts.global) {
      const profiles = listProfiles(true);
      console.log("Global (~/.greyzone/)");
      if (profiles.length > 0) {
        console.log(`Profiles: ${profiles.join(", ")}`);
      }
    } else {
      const configDir = findLocalConfigDir();
      if (!configDir) {
        console.log("No local .greyzone/config.yml found");
        return;
      }
      const config = getLocalConfig();
      console.log(`Project: ${config?.project ?? "(unknown)"}`);
      console.log(`Path: ${configDir}`);
      const profiles = listProfiles(false);
      if (profiles.length > 0) {
        console.log(`Profiles: ${profiles.join(", ")}`);
      }
      if (config?.github) {
        console.log(`GitHub: ${config.github.account} / ${config.github.repo}`);
      }
    }
  });

// === Environment Variables ===

addWriteOptions(
  program
    .command("set <key> <value>")
    .description("Set an environment variable")
).action(async (key: string, value: string, opts: CommonOptions) => {
  const confirmed = await confirmWrite("set", key, value, opts.yes);
  if (!confirmed) {
    console.log("Cancelled");
    process.exit(0);
  }

  const scope = formatScope(resolvedGlobal, resolvedProfile, resolvedLocked);

  if (resolvedLocked) {
    // Direct write to locked store
    const store = new EnvStore(resolvedGlobal, resolvedProfile, true);
    store.set(key, value);
    store.close();
    console.log(`[${scope}] ${key} = ${maskValue(value)}`);
  } else {
    // Use setEnv which checks locked key protection
    const result = setEnv(resolvedGlobal, resolvedProfile, key, value);
    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
    console.log(`[${scope}] ${key} = ${value}`);
  }
});

addCommonOptions(
  program
    .command("get <key>")
    .description("Get an environment variable")
).action((key: string) => {
  let value: string | null;
  if (resolvedLocked) {
    // Direct read from locked store only
    const store = new EnvStore(resolvedGlobal, resolvedProfile, true);
    value = store.get(key);
    store.close();
  } else {
    // Use getEnv which includes hierarchy fallback
    const result = getEnv(resolvedGlobal, resolvedProfile, key);
    value = result.value;
  }

  if (value !== null) {
    console.log(resolvedLocked ? maskValue(value) : value);
  } else {
    console.error(`Key not found: ${key}`);
    process.exit(1);
  }
});

addCommonOptions(
  program
    .command("list")
    .description("List all environment variable keys")
).action(() => {
  let entries;
  if (resolvedLocked) {
    // Direct list from locked store only
    const store = new EnvStore(resolvedGlobal, resolvedProfile, true);
    entries = store.list();
    store.close();
  } else {
    // Use listEnv which includes hierarchy merge
    entries = listEnv(resolvedGlobal, resolvedProfile);
  }

  if (entries.length === 0) {
    const scope = resolvedLocked ? "locked" : "";
    console.log(`No ${scope} environment variables found`.replace("  ", " ").trim());
  } else {
    for (const entry of entries) {
      console.log(entry.key);
    }
  }
});

addWriteOptions(
  program
    .command("delete <key>")
    .description("Delete an environment variable")
).action(async (key: string, opts: CommonOptions) => {
  const confirmed = await confirmWrite("delete", key, undefined, opts.yes);
  if (!confirmed) {
    console.log("Cancelled");
    process.exit(0);
  }

  const scope = formatScope(resolvedGlobal, resolvedProfile, resolvedLocked);

  let deleted: boolean;
  if (resolvedLocked) {
    const store = new EnvStore(resolvedGlobal, resolvedProfile, true);
    deleted = store.delete(key);
    store.close();
  } else {
    const result = deleteEnv(resolvedGlobal, resolvedProfile, key);
    deleted = result.deleted;
  }

  if (deleted) {
    console.log(`[${scope}] Deleted: ${key}`);
  } else {
    console.error(`Key not found: ${key}`);
    process.exit(1);
  }
});

// === Version Control ===

addCommonOptions(
  program
    .command("log [key]")
    .description("Show change history")
    .option("-a, --all", "Show history from all profiles")
).action((key: string | undefined, opts: { all?: boolean } & CommonOptions) => {
  const history = opts.all
    ? getAllHistory(resolvedGlobal, key)
    : getHistory(resolvedGlobal, resolvedProfile, key);

  if (history.length === 0) {
    console.log("No history found");
  } else {
    for (const entry of history) {
      const oldVal = entry.old_value
        ? (entry.isLocked ? maskValue(entry.old_value) : entry.old_value)
        : "(none)";
      const newVal = entry.new_value
        ? (entry.isLocked ? maskValue(entry.new_value) : entry.new_value)
        : "(none)";
      const type = entry.isLocked ? "locked" : "value";
      const profilePrefix = opts.all ? `[${entry.profile}] ` : "";
      console.log(`${profilePrefix}[${entry.timestamp}] ${entry.action} ${type} ${entry.key}: ${oldVal} -> ${newVal}`);
    }
  }
});

addWriteOptions(
  program
    .command("rollback <target>")
    .description("Rollback to a specific point (datetime or -N for steps)")
).action(async (target: string, opts: CommonOptions) => {
  const confirmed = await confirmWrite("rollback", target, undefined, opts.yes);
  if (!confirmed) {
    console.log("Cancelled");
    process.exit(0);
  }

  rollback(resolvedGlobal, resolvedProfile, target);
  console.log(`Rolled back to: ${target}`);
});

addWriteOptions(
  program
    .command("undo")
    .description("Undo the last change")
).action(async (opts: CommonOptions) => {
  const confirmed = await confirmWrite("undo", "-1", undefined, opts.yes);
  if (!confirmed) {
    console.log("Cancelled");
    process.exit(0);
  }

  rollback(resolvedGlobal, resolvedProfile, -1);
  console.log("Undid last change");
});

addCommonOptions(
  program
    .command("diff <dt1> <dt2>")
    .description("Show diff between two points in time")
).action((dt1: string, dt2: string) => {
  const entries = diff(resolvedGlobal, resolvedProfile, dt1, dt2);

  if (entries.length === 0) {
    console.log("No changes in the specified range");
  } else {
    for (const entry of entries) {
      const oldVal = entry.old_value
        ? (entry.isLocked ? maskValue(entry.old_value) : entry.old_value)
        : "(none)";
      const newVal = entry.new_value
        ? (entry.isLocked ? maskValue(entry.new_value) : entry.new_value)
        : "(none)";
      const type = entry.isLocked ? "locked" : "value";
      console.log(`[${entry.timestamp}] ${entry.action} ${type} ${entry.key}: ${oldVal} -> ${newVal}`);
    }
  }
});

// === Import/Export ===

addCommonOptions(
  program
    .command("export")
    .description("Export environment variables for shell (e.g., eval $(gz export))")
    .option("-o, --output <file>", "Write to file")
    .option("-k, --keys <keys...>", "Export only specific keys")
).action((opts: { output?: string; keys?: string[] } & CommonOptions) => {
  // Always output real values (this is the point of export)
  exportEnv(resolvedGlobal, resolvedProfile, opts.output, resolvedLocked, opts.keys, false);
});

addWriteOptions(
  program
    .command("import <file>")
    .description("Import environment variables from .env file")
    .option("-k, --keys <keys...>", "Import only specific keys")
).action(async (file: string, opts: { keys?: string[] } & CommonOptions) => {
  const scope = formatScope(resolvedGlobal, resolvedProfile, resolvedLocked);

  const header = resolvedLocked ? "=== Import Confirmation (LOCKED) ===" : "=== Import Confirmation ===";
  const footer = resolvedLocked ? "=====================================" : "===========================";

  console.log(`\n${header}`);
  console.log(`  File:    ${file}`);
  console.log(`  Scope:   ${scope}`);
  if (opts.keys) {
    console.log(`  Keys:    ${opts.keys.join(", ")}`);
  }
  console.log(`${footer}\n`);

  if (!opts.yes) {
    const confirmed = await confirm("Proceed?");
    if (!confirmed) {
      console.log("Cancelled");
      process.exit(0);
    }
  }

  importEnvFile(file, resolvedGlobal, resolvedProfile, resolvedLocked, opts.keys);
});

// === GitHub Integration ===

program
  .command("github")
  .description("Configure GitHub settings")
  .option("-g, --global", "Configure for global scope")
  .option("--account <account>", "GitHub username for token verification")
  .option("--repo <repo>", "Target repository (owner/repo)")
  .action((opts: { global?: boolean; account?: string; repo?: string }) => {
    const isGlobal = opts.global ?? false;

    if (!isGlobal && !findLocalConfigDir()) {
      console.error("Error: No .greyzone/config.yml found. Run 'gz init <project>' first, or use -g for global.");
      process.exit(1);
    }

    // If no options provided, show current config
    if (!opts.account && !opts.repo) {
      const config = getGitHubConfig(isGlobal);
      if (!config) {
        console.log("No GitHub configuration set");
        console.log("Use: gz github --account <username> --repo <owner/repo>");
      } else {
        console.log(`Account: ${config.account}`);
        console.log(`Repo:    ${config.repo}`);
      }
      return;
    }

    // Get existing config to merge
    const existing = getGitHubConfig(isGlobal);
    const account = opts.account ?? existing?.account;
    const repo = opts.repo ?? existing?.repo;

    if (!account || !repo) {
      console.error("Error: Both --account and --repo are required");
      if (!account) console.error("  Missing: --account <username>");
      if (!repo) console.error("  Missing: --repo <owner/repo>");
      process.exit(1);
    }

    setGitHubConfig(isGlobal, { account, repo });
    console.log(`GitHub configuration saved${isGlobal ? " (global)" : ""}:`);
    console.log(`  Account: ${account}`);
    console.log(`  Repo:    ${repo}`);
  });

addCommonOptions(
  program
    .command("push <key>")
    .description("Push environment variable to GitHub secrets")
    .option("--github", "Push to GitHub secrets")
    .option("--repo <repo>", "Override target repository (owner/repo)")
    .option("-y, --yes", "Skip confirmation prompt")
).action(async (key: string, opts: { github?: boolean; repo?: string; yes?: boolean } & CommonOptions) => {
  if (!opts.github) {
    console.error("Currently only --github is supported");
    process.exit(1);
  }

  const githubConfig = getGitHubConfig(resolvedGlobal);

  // Determine target repo
  const targetRepo = opts.repo ?? githubConfig?.repo;

  // Get credentials
  const credentials = getGitHubCredentials();
  if (!credentials) {
    console.error("Error: GitHub token not found.");
    console.error("Set GITHUB_TOKEN or GH_TOKEN environment variable, or login with 'gh auth login'");
    process.exit(1);
  }

  // Verify account if configured
  if (githubConfig?.account) {
    const { getAuthenticatedUser } = await import("./github.js");
    const tokenUser = await getAuthenticatedUser(credentials.token);

    if (tokenUser !== githubConfig.account) {
      console.error("\nAccount Mismatch!");
      console.error(`  Configured account: ${githubConfig.account}`);
      console.error(`  Token account:      ${tokenUser}`);
      console.error(`  Token source:       ${credentials.source}`);
      console.error("\nUse 'gz github --account' to update configuration, or use a different token.");
      process.exit(1);
    }
  }

  const result = getEnv(resolvedGlobal, resolvedProfile, key);

  if (!result.found) {
    console.error(`Key not found: ${key}`);
    process.exit(1);
  }

  await pushToGitHub(key, result.value!, targetRepo, opts.yes, credentials.token);
});

program.parse();
