import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { isValidBetId } from "../bep/id";
import {
  evaluateManualComparison,
  formatManualComparisonOperator,
  parseManualLeadingIndicator,
} from "../bep/checkInput";
import { BETS_DIR, EVIDENCE_DIR, initRepo } from "../fs/init";
import { runCheckPrompt } from "../ui/checkPrompt";

type ManualEvidenceSnapshot = {
  id: string;
  checked_at: string;
  mode: "manual";
  leading_indicator: {
    type: "manual";
    operator: "lt" | "lte" | "eq" | "gte" | "gt";
    target: number;
  };
  observed_value: number;
  meets_target: boolean;
  notes?: string;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function runCheck(rootDir: string, id: string): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase slug format like 'landing-page'.`);
    return 1;
  }

  await initRepo(rootDir);

  const relativeBetPath = path.join(BETS_DIR, `${id}.md`);
  const absoluteBetPath = path.join(rootDir, relativeBetPath);

  if (!(await pathExists(absoluteBetPath))) {
    console.error(`Bet '${id}' does not exist at ${relativeBetPath}. Run 'bep new ${id}' first.`);
    return 1;
  }

  let parsed;
  try {
    const markdown = await readFile(absoluteBetPath, "utf8");
    parsed = matter(markdown);
  } catch (error) {
    console.error(`Failed to parse BEP file at ${relativeBetPath}: ${(error as Error).message}`);
    return 1;
  }

  const leadingIndicatorResult = parseManualLeadingIndicator(
    (parsed.data as { leading_indicator?: unknown }).leading_indicator,
  );

  if (!leadingIndicatorResult.ok) {
    console.error(
      `Bet '${id}' has invalid leading_indicator: ${leadingIndicatorResult.error} Expected { type: "manual", operator: "lt|lte|eq|gte|gt", target: <number> }.`,
    );
    return 1;
  }

  const promptResult = await runCheckPrompt();
  if (promptResult.cancelled) {
    console.error("Cancelled. No evidence was written.");
    return 1;
  }

  const meetsTarget = evaluateManualComparison(
    promptResult.observedValue,
    leadingIndicatorResult.value.operator,
    leadingIndicatorResult.value.target,
  );

  const snapshot: ManualEvidenceSnapshot = {
    id,
    checked_at: new Date().toISOString(),
    mode: "manual",
    leading_indicator: leadingIndicatorResult.value,
    observed_value: promptResult.observedValue,
    meets_target: meetsTarget,
    notes: promptResult.notes,
  };

  const relativeEvidencePath = path.join(EVIDENCE_DIR, `${id}.json`);
  const absoluteEvidencePath = path.join(rootDir, relativeEvidencePath);

  try {
    await writeFile(absoluteEvidencePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`Failed to write evidence at ${relativeEvidencePath}: ${(error as Error).message}`);
    return 1;
  }

  const comparisonLabel = `${promptResult.observedValue} ${formatManualComparisonOperator(leadingIndicatorResult.value.operator)} ${leadingIndicatorResult.value.target}`;
  console.log(
    `Captured manual evidence for '${id}' at ${relativeEvidencePath}. Result: ${meetsTarget ? "PASS" : "FAIL"} (${comparisonLabel}).`,
  );
  return 0;
}
