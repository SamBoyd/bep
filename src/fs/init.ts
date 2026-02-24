import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROVIDER_CONFIG_PATH } from "../providers/config.js";

export const BETS_DIR = "bets";
export const LOGS_DIR = path.join(BETS_DIR, "_logs");
export const EVIDENCE_DIR = path.join(BETS_DIR, "_evidence");
export const STATE_PATH = path.join(BETS_DIR, "_state.json");
const GITIGNORE_PATH = ".gitignore";
const PROVIDER_GITIGNORE_ENTRY = ".bep.providers.json";

export type InitResult = {
  createdPaths: string[];
  alreadyInitialized: boolean;
};

const DEFAULT_STATE = {
  active: [],
};
const DEFAULT_PROVIDER_CONFIG = {
  mixpanel: {
    service_account_creds: "<serviceaccount_username>:<serviceaccount_secret>",
  },
};

const REQUIRED_INIT_PATHS = [BETS_DIR, LOGS_DIR, EVIDENCE_DIR, STATE_PATH] as const;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function initRepo(rootDir: string): Promise<InitResult> {
  const createdPaths: string[] = [];

  for (const relativeDir of [BETS_DIR, LOGS_DIR, EVIDENCE_DIR]) {
    const absoluteDir = path.join(rootDir, relativeDir);
    const existed = await pathExists(absoluteDir);
    await mkdir(absoluteDir, { recursive: true });
    if (!existed) {
      createdPaths.push(relativeDir);
    }
  }

  const statePath = path.join(rootDir, STATE_PATH);
  const stateExists = await pathExists(statePath);
  if (!stateExists) {
    await writeFile(statePath, `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`, "utf8");
    createdPaths.push(STATE_PATH);
  }

  const providerConfigPath = path.join(rootDir, PROVIDER_CONFIG_PATH);
  const providerConfigExists = await pathExists(providerConfigPath);
  if (!providerConfigExists) {
    await writeFile(providerConfigPath, `${JSON.stringify(DEFAULT_PROVIDER_CONFIG, null, 2)}\n`, "utf8");
    createdPaths.push(PROVIDER_CONFIG_PATH);
  }

  const gitRoot = await findGitRepoRoot(rootDir);
  if (gitRoot) {
    await ensureGitignoreEntry(gitRoot, createdPaths);
  }

  return {
    createdPaths,
    alreadyInitialized: createdPaths.length === 0,
  };
}

async function findGitRepoRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (await pathExists(path.join(currentDir, ".git"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

async function ensureGitignoreEntry(gitRoot: string, createdPaths: string[]): Promise<void> {
  const gitignorePath = path.join(gitRoot, GITIGNORE_PATH);
  const exists = await pathExists(gitignorePath);
  if (!exists) {
    await writeFile(gitignorePath, `${PROVIDER_GITIGNORE_ENTRY}\n`, "utf8");
    createdPaths.push(GITIGNORE_PATH);
    return;
  }

  const raw = await readFile(gitignorePath, "utf8");
  const lines = raw.split(/\r?\n/);
  if (lines.includes(PROVIDER_GITIGNORE_ENTRY)) {
    return;
  }

  const suffix = raw.length === 0 || raw.endsWith("\n") ? "" : "\n";
  await writeFile(gitignorePath, `${raw}${suffix}${PROVIDER_GITIGNORE_ENTRY}\n`, "utf8");
}

async function isInitializedRepoRoot(candidateRootDir: string): Promise<boolean> {
  for (const relativePath of REQUIRED_INIT_PATHS) {
    const absolutePath = path.join(candidateRootDir, relativePath);
    if (!(await pathExists(absolutePath))) {
      return false;
    }
  }

  return true;
}

export async function findInitializedRepo(startDir: string): Promise<{ rootDir: string; betsDir: string } | null> {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (await isInitializedRepoRoot(currentDir)) {
      return {
        rootDir: currentDir,
        betsDir: path.join(currentDir, BETS_DIR),
      };
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

export async function ensureInitializedRepo(startDir: string): Promise<{ rootDir: string; betsDir: string }> {
  const found = await findInitializedRepo(startDir);
  if (!found) {
    throw new Error("fatal: not a bep repository (or any of the parent directories): bets");
  }

  return found;
}
