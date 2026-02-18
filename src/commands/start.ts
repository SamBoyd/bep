import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { isValidBetId } from "../bep/id";
import { BETS_DIR, initRepo } from "../fs/init";
import { addActiveSession, readState, writeState } from "../state/state";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function runStart(rootDir: string, id: string): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase slug format like 'landing-page'.`);
    return 1;
  }

  await initRepo(rootDir);

  const relativePath = path.join(BETS_DIR, `${id}.md`);
  const absolutePath = path.join(rootDir, relativePath);

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
    const markdown = await readFile(absolutePath, "utf8");
    parsed = matter(markdown);
  } catch (error) {
    console.error(`Failed to parse BEP file at ${relativePath}: ${(error as Error).message}`);
    return 1;
  }

  parsed.data.status = "active";

  try {
    await writeFile(absolutePath, matter.stringify(parsed.content, parsed.data), "utf8");
    await writeState(rootDir, next.state);
  } catch (error) {
    console.error(`Failed to start bet '${id}': ${(error as Error).message}`);
    return 1;
  }

  console.log(`Started bet '${id}'.`);
  return 0;
}
