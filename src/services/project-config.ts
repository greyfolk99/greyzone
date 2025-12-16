import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parse as parseYaml } from "yaml";
import {
  getLocalConfig,
  getGlobalConfig,
  updateLocalConfig,
  updateGlobalConfig,
  GitHubConfig,
} from "../context.js";

export type { GitHubConfig };

/**
 * Get GitHub config (local takes priority over global)
 */
export function getGitHubConfig(global: boolean): GitHubConfig | null {
  if (global) {
    const config = getGlobalConfig();
    return config?.github ?? null;
  }

  // Local first, then global fallback
  const localConfig = getLocalConfig();
  if (localConfig?.github) {
    return localConfig.github;
  }

  const globalConfig = getGlobalConfig();
  return globalConfig?.github ?? null;
}

/**
 * Set GitHub config
 */
export function setGitHubConfig(global: boolean, github: GitHubConfig): void {
  if (global) {
    updateGlobalConfig({ github });
  } else {
    updateLocalConfig({ github });
  }
}

// Get GitHub token from environment or gh CLI cache
export interface GitHubCredentials {
  token: string;
  user?: string;  // from gh CLI cache
  source: "env" | "gh-cli";
}

export function getGitHubCredentials(): GitHubCredentials | null {
  // 1. Check environment variables
  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  // 2. Check gh CLI cache
  const ghConfigPath = join(homedir(), ".config", "gh", "hosts.yml");
  if (existsSync(ghConfigPath)) {
    try {
      const content = readFileSync(ghConfigPath, "utf-8");
      const hosts = parseYaml(content) as Record<string, { oauth_token?: string; user?: string }>;
      const github = hosts["github.com"];
      if (github?.oauth_token) {
        return {
          token: github.oauth_token,
          user: github.user,
          source: "gh-cli",
        };
      }
    } catch {
      // Failed to parse gh config
    }
  }

  return null;
}
