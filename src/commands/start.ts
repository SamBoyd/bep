import { readBetFile, getBetAbsolutePath, getBetRelativePath, pathExists, writeBetFile } from "../fs/bets";
import { isValidBetId } from "../bep/id";
import { ensureInitializedRepo } from "../fs/init";
import { addActiveSession, readState, writeState } from "../state/state";

export async function runStart(id: string): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase id format like 'landing-page' or 'landing_page'.`);
    return 1;
  }

  let rootDir: string;
  try {
    const cwd = process.cwd();
    ({ rootDir } = await ensureInitializedRepo(cwd));
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

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

  let bet;
  try {
    bet = (await readBetFile(rootDir, id)).bet;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  bet.data.status = "active";

  try {
    await writeBetFile(rootDir, id, bet);
    await writeState(rootDir, next.state);
  } catch (error) {
    console.error(`Failed to start bet '${id}': ${(error as Error).message}`);
    return 1;
  }

  console.log(`Started bet '${id}'.`);
  return 0;
}
