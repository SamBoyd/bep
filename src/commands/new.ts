import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidBetId } from "../bep/id.js";
import { renderNewBetMarkdown } from "../bep/template.js";
import { BETS_DIR, ensureInitializedRepo } from "../fs/init.js";
import { runNewWizard } from "../ui/newWizard.js";
import { normalizeBetName } from "../ui/newBetName.js";

function isInteractiveTty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function invalidIdError(id: string): string {
  return `Invalid bet id '${id}'. Use id format like 'landing-page' or 'landing_page'.`;
}

export async function runNew(rawId?: string): Promise<number> {
  const initialBetName = rawId ? normalizeBetName(rawId) : undefined;
  if (!initialBetName && !isInteractiveTty()) {
    console.error("Missing bet name. Run 'bep new <name>' or use an interactive terminal.");
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

  const validateBetName = (normalizedName: string): string | undefined => {
    if (!isValidBetId(normalizedName)) {
      return invalidIdError(normalizedName);
    }

    const relativePath = path.join(BETS_DIR, `${normalizedName}.md`);
    const absolutePath = path.join(rootDir, relativePath);
    if (existsSync(absolutePath)) {
      return `Bet '${normalizedName}' already exists at ${relativePath}. Choose a unique id.`;
    }

    return undefined;
  };

  const wizardResult = await runNewWizard({
    initialBetName,
    validateBetName,
  });
  if (wizardResult.cancelled) {
    console.error("Cancelled. No files were created.");
    return 1;
  }

  const id = wizardResult.values.betName;
  const relativePath = path.join(BETS_DIR, `${id}.md`);
  const absolutePath = path.join(rootDir, relativePath);
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
