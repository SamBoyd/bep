import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidBetId } from "../bep/id.js";
import { renderNewBetMarkdown } from "../bep/template.js";
import { BETS_DIR, ensureInitializedRepo } from "../fs/init.js";
import { runNewWizard } from "../ui/newWizard.js";
import { normalizeBetName, promptNewBetName } from "../ui/newBetName.js";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isInteractiveTty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function invalidIdError(id: string): string {
  return `Invalid bet id '${id}'. Use id format like 'landing-page' or 'landing_page'.`;
}

export async function runNew(rawId?: string): Promise<number> {
  let id = rawId ? normalizeBetName(rawId) : undefined;
  if (!id) {
    if (!isInteractiveTty()) {
      console.error("Missing bet name. Run 'bep new <name>' or use an interactive terminal.");
      return 1;
    }

    const nameResult = await promptNewBetName();
    if (nameResult.cancelled) {
      console.error("Cancelled. No files were created.");
      return 1;
    }

    id = normalizeBetName(nameResult.value);
  }

  if (!isValidBetId(id)) {
    console.error(invalidIdError(id));
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

  const relativePath = path.join(BETS_DIR, `${id}.md`);
  const absolutePath = path.join(rootDir, relativePath);

  if (await pathExists(absolutePath)) {
    console.error(`Bet '${id}' already exists at ${relativePath}. Choose a unique id.`);
    return 1;
  }

  const wizardResult = await runNewWizard();
  if (wizardResult.cancelled) {
    console.error("Cancelled. No files were created.");
    return 1;
  }

  const markdown = renderNewBetMarkdown({
    id,
    createdAt: new Date().toISOString(),
    leadingIndicator: wizardResult.values.leadingIndicator,
    maxHours: wizardResult.values.maxHours,
    maxCalendarDays: wizardResult.values.maxCalendarDays,
    primaryAssumption: wizardResult.values.primaryAssumption,
    rationale: wizardResult.values.rationale,
    validationPlan: wizardResult.values.validationPlan,
    notes: wizardResult.values.notes,
  });

  try {
    await writeFile(absolutePath, markdown, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      console.error(`Bet '${id}' already exists at ${relativePath}. Choose a unique id.`);
      return 1;
    }

    throw error;
  }

  console.log(`\nCreated ${relativePath}.`);
  return 0;
}
