import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BETS_DIR = "bets";
export const LOGS_DIR = path.join(BETS_DIR, "_logs");
export const EVIDENCE_DIR = path.join(BETS_DIR, "_evidence");
export const STATE_PATH = path.join(BETS_DIR, "_state.json");

export type InitResult = {
  createdPaths: string[];
  alreadyInitialized: boolean;
};

const DEFAULT_STATE = {
  active: [],
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

  return {
    createdPaths,
    alreadyInitialized: createdPaths.length === 0,
  };
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
