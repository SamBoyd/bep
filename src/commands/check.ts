import { writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidBetId } from "../bep/id";
import { getBetAbsolutePath, getBetRelativePath, pathExists, readBetFile } from "../fs/bets";
import { EVIDENCE_DIR, ensureInitializedRepo } from "../fs/init";
import { listRegisteredProviderTypes, resolveProviderModule } from "../providers/registry";
import { formatManualComparisonOperator } from "../providers/manual";
import type { LeadingIndicator } from "../providers/types";

type EvidenceSnapshot = {
  id: string;
  checked_at: string;
  mode: string;
  leading_indicator: LeadingIndicator;
  observed_value: number;
  meets_target: boolean;
  notes?: string;
  meta?: Record<string, unknown>;
};

function getLeadingIndicatorType(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && type.length > 0 ? type : null;
}

function formatComparisonLabel(indicator: LeadingIndicator, observedValue: number): string {
  if (indicator.type === "manual" || indicator.type === "mixpanel") {
    return `${observedValue} ${formatManualComparisonOperator(indicator.operator)} ${indicator.target}`;
  }

  return String(observedValue);
}

export async function runCheck(id: string): Promise<number> {
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

  const relativeBetPath = getBetRelativePath(id);
  const absoluteBetPath = getBetAbsolutePath(rootDir, id);

  if (!(await pathExists(absoluteBetPath))) {
    console.error(`Bet '${id}' does not exist at ${relativeBetPath}. Run 'bep new ${id}' first.`);
    return 1;
  }

  let bet;
  try {
    bet = (await readBetFile(rootDir, id)).bet;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const rawLeadingIndicator = bet.data.leading_indicator;
  const leadingIndicatorType = getLeadingIndicatorType(rawLeadingIndicator);
  if (!leadingIndicatorType) {
    console.error("Bet has invalid leading_indicator: missing string field 'type'.");
    return 1;
  }

  const module = resolveProviderModule(leadingIndicatorType);
  if (!module) {
    const knownTypes = listRegisteredProviderTypes().join(", ");
    console.error(
      `Bet has unsupported leading_indicator.type '${leadingIndicatorType}'. Supported types: ${knownTypes}.`,
    );
    return 1;
  }

  const parsedIndicator = module.adapter.parseIndicator(rawLeadingIndicator);
  if (!parsedIndicator.ok) {
    console.error(`Bet '${id}' has invalid leading_indicator: ${parsedIndicator.error}`);
    return 1;
  }

  let checkResult: Awaited<ReturnType<typeof module.adapter.runCheck>>;
  try {
    checkResult = await module.adapter.runCheck(parsedIndicator.value, {
      rootDir,
      betId: id,
      nowIso: new Date().toISOString(),
    });
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  if ("cancelled" in checkResult) {
    console.error("Cancelled. No evidence was written.");
    return 1;
  }

  const snapshot: EvidenceSnapshot = {
    id,
    checked_at: new Date().toISOString(),
    mode: parsedIndicator.value.type,
    leading_indicator: parsedIndicator.value,
    observed_value: checkResult.observedValue,
    meets_target: checkResult.meetsTarget,
    notes: checkResult.notes,
    meta: checkResult.meta,
  };

  const relativeEvidencePath = path.join(EVIDENCE_DIR, `${id}.json`);
  const absoluteEvidencePath = path.join(rootDir, relativeEvidencePath);

  try {
    await writeFile(absoluteEvidencePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`Failed to write evidence at ${relativeEvidencePath}: ${(error as Error).message}`);
    return 1;
  }

  const comparisonLabel = formatComparisonLabel(parsedIndicator.value, checkResult.observedValue);
  console.log(
    `Captured ${parsedIndicator.value.type} evidence for '${id}' at ${relativeEvidencePath}. Result: ${checkResult.meetsTarget ? "PASS" : "FAIL"} (${comparisonLabel}).`,
  );
  return 0;
}
