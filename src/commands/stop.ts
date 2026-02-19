import { appendFile } from "node:fs/promises";
import path from "node:path";
import { isValidBetId } from "../bep/id";
import { getBetAbsolutePath, getBetRelativePath, pathExists, readBetFile, writeBetFile } from "../fs/bets";
import { LOGS_DIR, initRepo } from "../fs/init";
import { readState, removeActiveSessions, writeState } from "../state/state";

type StopLogEntry = {
  id: string;
  started_at: string;
  stopped_at: string;
  duration_seconds: number;
};

export async function runStop(rootDir: string, id: string): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase slug format like 'landing-page'.`);
    return 1;
  }

  await initRepo(rootDir);

  let state;
  try {
    state = await readState(rootDir);
  } catch (error) {
    console.error(`Failed to read state file at bets/_state.json: ${(error as Error).message}`);
    return 1;
  }

  const next = removeActiveSessions(state, id);
  if (next.removed.length === 0) {
    console.log(`Bet '${id}' is not active.`);
    return 0;
  }

  const stoppedAt = new Date();
  const stoppedAtIso = stoppedAt.toISOString();
  const logs: StopLogEntry[] = [];

  for (const session of next.removed) {
    const startedMs = Date.parse(session.started_at);
    if (Number.isNaN(startedMs)) {
      console.error(`Active session for '${id}' has invalid started_at: '${session.started_at}'.`);
      return 1;
    }

    const durationSeconds = Math.max(0, Math.floor((stoppedAt.getTime() - startedMs) / 1000));
    logs.push({
      id,
      started_at: session.started_at,
      stopped_at: stoppedAtIso,
      duration_seconds: durationSeconds,
    });
  }

  const relativeBetPath = getBetRelativePath(id);
  const absoluteBetPath = getBetAbsolutePath(rootDir, id);

  let parsedBetForPause: Awaited<ReturnType<typeof readBetFile>>["parsed"] | null = null;
  const hasBetFile = await pathExists(absoluteBetPath);

  if (hasBetFile) {
    try {
      parsedBetForPause = (await readBetFile(rootDir, id)).parsed;
      parsedBetForPause.data.status = "paused";
    } catch (error) {
      console.error((error as Error).message);
      return 1;
    }
  }

  const logPath = path.join(rootDir, LOGS_DIR, `${id}.jsonl`);
  const serializedLogs = logs.map((line) => JSON.stringify(line)).join("\n").concat("\n");

  try {
    if (parsedBetForPause !== null) {
      await writeBetFile(rootDir, id, parsedBetForPause);
    }
    await appendFile(logPath, serializedLogs, "utf8");
    await writeState(rootDir, next.state);
  } catch (error) {
    console.error(`Failed to stop bet '${id}': ${(error as Error).message}`);
    return 1;
  }

  if (!hasBetFile) {
    console.error(`Warning: Bet file '${relativeBetPath}' is missing. Session was stopped and logged.`);
  }

  console.log(`Stopped bet '${id}' (${next.removed.length} session(s) logged).`);
  return 0;
}
