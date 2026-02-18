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
