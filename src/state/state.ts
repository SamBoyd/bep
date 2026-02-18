import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { STATE_PATH } from "../fs/init";

export type ActiveSession = {
  id: string;
  started_at: string;
};

export type BepState = {
  active: ActiveSession[];
};

function isValidActiveSession(value: unknown): value is ActiveSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ActiveSession>;
  return typeof candidate.id === "string" && candidate.id.length > 0 && typeof candidate.started_at === "string";
}

function parseState(raw: string): BepState {
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("State file must contain a JSON object.");
  }

  const active = (parsed as { active?: unknown }).active;
  if (!Array.isArray(active)) {
    throw new Error("State file field 'active' must be an array.");
  }

  for (const [index, session] of active.entries()) {
    if (!isValidActiveSession(session)) {
      throw new Error(`State file has invalid active session at index ${index}.`);
    }
  }

  return { active };
}

export async function readState(rootDir: string): Promise<BepState> {
  const statePath = path.join(rootDir, STATE_PATH);
  const raw = await readFile(statePath, "utf8");

  return parseState(raw);
}

export async function writeState(rootDir: string, state: BepState): Promise<void> {
  const statePath = path.join(rootDir, STATE_PATH);
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function addActiveSession(
  state: BepState,
  id: string,
  startedAt: string,
): { state: BepState; alreadyActive: boolean } {
  const alreadyActive = state.active.some((session) => session.id === id);
  if (alreadyActive) {
    return { state, alreadyActive: true };
  }

  return {
    alreadyActive: false,
    state: {
      active: [...state.active, { id, started_at: startedAt }],
    },
  };
}

export function removeActiveSessions(state: BepState, id: string): { state: BepState; removed: ActiveSession[] } {
  const removed = state.active.filter((session) => session.id === id);
  if (removed.length === 0) {
    return { state, removed };
  }

  return {
    removed,
    state: {
      active: state.active.filter((session) => session.id !== id),
    },
  };
}
