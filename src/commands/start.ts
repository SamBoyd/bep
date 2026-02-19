import { readBetFile, getBetAbsolutePath, getBetRelativePath, pathExists, writeBetFile } from "../fs/bets";
import { isValidBetId } from "../bep/id";
import { initRepo } from "../fs/init";
import { addActiveSession, readState, writeState } from "../state/state";

export async function runStart(rootDir: string, id: string): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase slug format like 'landing-page'.`);
    return 1;
  }

  await initRepo(rootDir);

  const relativePath = getBetRelativePath(id);
  const absolutePath = getBetAbsolutePath(rootDir, id);

  if (!(await pathExists(absolutePath))) {
    console.error(`Bet '${id}' does not exist at ${relativePath}. Run 'bep new ${id}' first.`);
    return 1;
  }

  let state;
  try {
    state = await readState(rootDir);
  } catch (error) {
    console.error(`Failed to read state file at bets/_state.json: ${(error as Error).message}`);
    return 1;
  }

  const now = new Date().toISOString();
  const next = addActiveSession(state, id, now);

  if (next.alreadyActive) {
    console.log(`Bet '${id}' is already active.`);
    return 0;
  }

  let parsed;
  try {
    const betFile = await readBetFile(rootDir, id);
    parsed = betFile.parsed;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  parsed.data.status = "active";

  try {
    await writeBetFile(rootDir, id, parsed);
    await writeState(rootDir, next.state);
  } catch (error) {
    console.error(`Failed to start bet '${id}': ${(error as Error).message}`);
    return 1;
  }

  console.log(`Started bet '${id}'.`);
  return 0;
}
