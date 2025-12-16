#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getLocalConfig,
  findLocalConfigDir,
  listProfiles,
} from "../context.js";
import { pushToGitHub, getAuthenticatedUser } from "../cli/github.js";
import {
  setEnv,
  getEnv,
  listEnv,
  deleteEnv,
  getHistory,
  rollback,
} from "../services/env.js";
import {
  getGitHubConfig,
  getGitHubCredentials,
} from "../services/project-config.js";
import { maskValue } from "../utils/mask.js";
import { DEFAULT_PROFILE } from "../config.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

const server = new Server(
  {
    name: "greyzone",
    version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // === Context ===
      {
        name: "get_context",
        description: "Get the current local project context (from .greyzone/config.yml)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_profiles",
        description: "List all profiles",
        inputSchema: {
          type: "object",
          properties: {
            global: {
              type: "boolean",
              description: "List global profiles instead of local",
            },
          },
        },
      },
      // === Environment Variables ===
      {
        name: "set_env",
        description: "Set an environment variable",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The environment variable key",
            },
            value: {
              type: "string",
              description: "The environment variable value",
            },
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "get_env",
        description: "Get an environment variable (returns actual value for use in scripts)",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The environment variable key",
            },
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "list_env",
        description: "List all environment variable keys (values not shown for security)",
        inputSchema: {
          type: "object",
          properties: {
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
          },
        },
      },
      {
        name: "delete_env",
        description: "Delete an environment variable",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The environment variable key",
            },
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "get_log",
        description: "Get change history",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Optional: filter by specific key",
            },
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
          },
        },
      },
      {
        name: "rollback",
        description: "Rollback to a datetime or -N steps",
        inputSchema: {
          type: "object",
          properties: {
            target: {
              type: "string",
              description: "Datetime string or -N for steps (e.g., '-1' for last change)",
            },
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
          },
          required: ["target"],
        },
      },
      {
        name: "push_to_github",
        description: "Push environment variables to GitHub secrets. Requires GitHub config (use gz github --account --repo). First call without confirm to see target details, then call with confirm: true to proceed.",
        inputSchema: {
          type: "object",
          properties: {
            keys: {
              type: "array",
              items: { type: "string" },
              description: "The environment variable keys to push",
            },
            profile: {
              type: "string",
              description: "Profile name (default: 'default')",
            },
            global: {
              type: "boolean",
              description: "Use global scope instead of local",
            },
            confirm: {
              type: "boolean",
              description: "Set to true to confirm and execute the push",
            },
          },
          required: ["keys"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Common parameters
    const isGlobal = (args?.global as boolean) ?? false;
    const profile = (args?.profile as string) ?? DEFAULT_PROFILE;

    // Check local config exists if not global
    if (!isGlobal && !findLocalConfigDir()) {
      return {
        content: [{ type: "text", text: "Error: No .greyzone/config.yml found in current directory hierarchy. Use global: true for global scope." }],
        isError: true,
      };
    }

    switch (name) {
      case "get_context": {
        const configDir = findLocalConfigDir();
        if (!configDir) {
          return {
            content: [{ type: "text", text: "No local .greyzone/config.yml found" }],
          };
        }
        const config = getLocalConfig();
        const profiles = listProfiles(false);
        let text = `Project: ${config?.project ?? "(unknown)"}\nPath: ${configDir}`;
        if (profiles.length > 0) {
          text += `\nProfiles: ${profiles.join(", ")}`;
        }
        if (config?.github) {
          text += `\nGitHub: ${config.github.account} / ${config.github.repo}`;
        }
        return {
          content: [{ type: "text", text }],
        };
      }

      case "list_profiles": {
        const profiles = listProfiles(isGlobal);
        return {
          content: [
            {
              type: "text",
              text: profiles.length > 0 ? profiles.join("\n") : "No profiles found",
            },
          ],
        };
      }

      case "set_env": {
        const key = args?.key as string;
        const value = args?.value as string;

        const result = setEnv(isGlobal, profile, key, value);
        if (!result.success) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: `${result.scope} Set ${key}` }],
        };
      }

      case "get_env": {
        const key = args?.key as string;

        const result = getEnv(isGlobal, profile, key);
        return {
          content: [
            { type: "text", text: result.found ? result.value! : `Key not found: ${key}` },
          ],
        };
      }

      case "list_env": {
        const entries = listEnv(isGlobal, profile);

        // Only return keys, not values (security)
        const result = entries.map((e) => e.key).join("\n");
        return {
          content: [
            { type: "text", text: result || "No environment variables found" },
          ],
        };
      }

      case "delete_env": {
        const key = args?.key as string;

        const result = deleteEnv(isGlobal, profile, key);
        return {
          content: [
            { type: "text", text: result.deleted ? `Deleted: ${key}` : `Key not found: ${key}` },
          ],
        };
      }

      case "get_log": {
        const key = args?.key as string | undefined;

        const history = getHistory(isGlobal, profile, key);
        const result = history
          .map(
            (e) => {
              const oldVal = e.old_value ? maskValue(e.old_value) : "(none)";
              const newVal = e.new_value ? maskValue(e.new_value) : "(none)";
              const type = e.isLocked ? "locked" : "value";
              return `[${e.timestamp}] ${e.action} ${type} ${e.key}: ${oldVal} -> ${newVal}`;
            }
          )
          .join("\n");

        return {
          content: [{ type: "text", text: result || "No history found" }],
        };
      }

      case "rollback": {
        const target = args?.target as string;

        rollback(isGlobal, profile, target);
        return {
          content: [{ type: "text", text: `Rolled back to: ${target}` }],
        };
      }

      case "push_to_github": {
        const keys = args?.keys as string[];
        const confirmPush = args?.confirm as boolean | undefined;

        // Require GitHub config
        const githubConfig = getGitHubConfig(isGlobal);
        if (!githubConfig) {
          return {
            content: [{ type: "text", text: "Error: No GitHub config. Use CLI: gz github --account <user> --repo <owner/repo>" }],
            isError: true,
          };
        }

        // Get credentials
        const credentials = getGitHubCredentials();
        if (!credentials) {
          return {
            content: [{ type: "text", text: "Error: GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN, or login with 'gh auth login'" }],
            isError: true,
          };
        }

        // Verify account matches
        const tokenUser = await getAuthenticatedUser(credentials.token);
        if (tokenUser !== githubConfig.account) {
          return {
            content: [{
              type: "text",
              text: `Error: Account mismatch!\n  Configured: ${githubConfig.account}\n  Token: ${tokenUser} (${credentials.source})\nUpdate config with: gz github --account ${tokenUser}`,
            }],
            isError: true,
          };
        }

        // Check all keys exist
        const missingKeys: string[] = [];
        for (const key of keys) {
          const result = getEnv(isGlobal, profile, key);
          if (!result.found) {
            missingKeys.push(key);
          }
        }
        if (missingKeys.length > 0) {
          return {
            content: [{ type: "text", text: `Error: Keys not found: ${missingKeys.join(", ")}` }],
            isError: true,
          };
        }

        // MCP requires explicit confirmation
        if (!confirmPush) {
          return {
            content: [{
              type: "text",
              text: `Push to GitHub secrets:\n  Account: ${githubConfig.account}\n  Repo: ${githubConfig.repo}\n  Profile: ${profile}\n  Keys: ${keys.join(", ")}\n\nCall again with confirm: true to proceed.`,
            }],
          };
        }

        // Push all keys
        for (const key of keys) {
          const result = getEnv(isGlobal, profile, key);
          await pushToGitHub(key, result.value!, githubConfig.repo, true, credentials.token);
        }

        return {
          content: [{ type: "text", text: `Pushed ${keys.length} key(s) to GitHub secrets in ${githubConfig.repo}` }],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Greyzone MCP server started");
}

main().catch(console.error);
