import { execSync } from "child_process";
import sodium from "libsodium-wrappers";

interface GitHubPublicKey {
  key_id: string;
  key: string;
}

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      "GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable."
    );
  }
  return token;
}

export async function getAuthenticatedUser(token: string): Promise<string> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get authenticated user. Check your GitHub token.");
  }

  const user = await response.json() as { login: string };
  return user.login;
}

function getCurrentRepo(): string {
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    // Parse: git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (match) {
      return match[1];
    }
    throw new Error("Could not parse repository from git remote");
  } catch {
    throw new Error("Not in a git repository or no origin remote set");
  }
}

async function getPublicKey(repo: string, token: string): Promise<GitHubPublicKey> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get public key: ${response.status} ${error}`);
  }

  return response.json() as Promise<GitHubPublicKey>;
}

async function encryptSecret(publicKeyBase64: string, secretValue: string): Promise<string> {
  await sodium.ready;

  const keyBytes = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const messageBytes = sodium.from_string(secretValue);
  const encrypted = sodium.crypto_box_seal(messageBytes, keyBytes);

  return sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
}

export async function pushToGitHub(
  key: string,
  value: string,
  repo?: string,
  skipConfirm: boolean = false,
  token?: string
): Promise<void> {
  const effectiveToken = token ?? getGitHubToken();
  const targetRepo = repo ?? getCurrentRepo();
  const secretName = key.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

  // Confirm before pushing
  if (!skipConfirm) {
    const username = await getAuthenticatedUser(effectiveToken);

    console.log("\n=== GitHub Push Confirmation ===");
    console.log(`  Account:    ${username}`);
    console.log(`  Repository: ${targetRepo}`);
    console.log(`  Secret:     ${secretName}`);
    console.log(`  Key:        ${key}`);
    console.log("================================\n");

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Proceed? [y/N] ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("Aborted.");
      return;
    }
  }

  // Get the repository's public key
  const publicKey = await getPublicKey(targetRepo, effectiveToken);

  // Encrypt using libsodium sealed box (GitHub's required format)
  const encryptedValue = await encryptSecret(publicKey.key, value);

  // Create or update the secret
  const response = await fetch(
    `https://api.github.com/repos/${targetRepo}/actions/secrets/${secretName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set secret: ${response.status} ${error}`);
  }

  console.log(`Pushed ${key} as ${secretName} to GitHub secrets in ${targetRepo}`);
}
