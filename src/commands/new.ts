import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidBetId } from "../bep/id";
import { renderNewBetMarkdown } from "../bep/template";
import { BETS_DIR, initRepo } from "../fs/init";
import { runNewWizard } from "../ui/newWizard";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function runNew(rootDir: string, id: string): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase slug format like 'landing-page'.`);
    return 1;
  }

  await initRepo(rootDir);

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
    defaultAction: wizardResult.values.defaultAction,
    leadingIndicator: {
      type: "manual",
      target: wizardResult.values.leadingIndicatorTarget,
    },
    maxHours: wizardResult.values.maxHours,
    maxCalendarDays: wizardResult.values.maxCalendarDays,
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
