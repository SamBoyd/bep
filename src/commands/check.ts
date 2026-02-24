import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isCancel, select } from "@clack/prompts";
import { isValidBetId } from "../bep/id.js";
import { normalizeValidationStatus } from "../bep/status.js";
import { getBetAbsolutePath, getBetRelativePath, pathExists, readBetFile, writeBetFile } from "../fs/bets.js";
import { EVIDENCE_DIR, ensureInitializedRepo } from "../fs/init.js";
import { listRegisteredProviderTypes, resolveProviderModule } from "../providers/registry.js";
import { formatManualComparisonOperator } from "../providers/manual.js";
import type { LeadingIndicator } from "../providers/types.js";

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

type CheckOptions = {
  force?: boolean;
  rootDir?: string;
};

function hasPassedStatusInFrontmatter(markdown: string): boolean {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith("---")) {
    return false;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 3 || lines[0]?.trim() !== "---") {
    return false;
  }

  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (endIndex === -1) {
    return false;
  }

  const frontmatterLines = lines.slice(1, endIndex + 1);
  return frontmatterLines.some((line) => /^status:\s*passed\s*$/i.test(line.trim()));
}

async function hasPassingEvidence(rootDir: string, id: string): Promise<boolean> {
  const evidencePath = path.join(rootDir, EVIDENCE_DIR, `${id}.json`);
  if (!(await pathExists(evidencePath))) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(evidencePath, "utf8"));
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== "object") {
    return false;
  }

  return (parsed as { meets_target?: unknown }).meets_target === true;
}

function isInteractiveTty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

async function maybePromptUnpass(id: string): Promise<"keep" | "unpass" | "cancel"> {
  const value = await select({
    message: `Bet '${id}' is currently status: passed, but the forced check FAILED. Update status?`,
    options: [
      { label: "Keep status: passed", value: "keep" },
      { label: "Set status: pending", value: "unpass" },
    ],
    initialValue: "keep",
  });

  if (isCancel(value)) {
    return "cancel";
  }

  return value as "keep" | "unpass";
}

export async function runCheck(id: string, options: CheckOptions = {}): Promise<number> {
  if (!isValidBetId(id)) {
    console.error(`Invalid bet id '${id}'. Use lowercase id format like 'landing-page' or 'landing_page'.`);
    return 1;
  }

  let rootDir: string;
  try {
    if (options.rootDir) {
      const ensured = await ensureInitializedRepo(options.rootDir);
      if (ensured.rootDir !== options.rootDir) {
        throw new Error(`Expected BEP repo root at ${options.rootDir}, found ${ensured.rootDir}.`);
      }
      rootDir = ensured.rootDir;
    } else {
      const cwd = process.cwd();
      ({ rootDir } = await ensureInitializedRepo(cwd));
    }
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
    bet = await readBetFile(rootDir, id);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const validationStatus = normalizeValidationStatus(bet.bet.data.status);
  const isPassed = hasPassedStatusInFrontmatter(bet.markdown) || validationStatus === "passed";
  if (isPassed && !options.force) {
    if (await hasPassingEvidence(rootDir, id)) {
      console.log(`Bet '${id}' is status: passed; skipping validation check.`);
      return 0;
    }
  }

  const rawLeadingIndicator = bet.bet.data.leading_indicator;
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

  if (checkResult.meetsTarget) {
    bet.bet.data.status = "passed";
    try {
      await writeBetFile(rootDir, id, bet.bet);
    } catch (error) {
      console.error(`Failed to mark bet '${id}' as passed: ${(error as Error).message}`);
      return 1;
    }

    console.log(`Marked bet '${id}' as status: passed.`);
    return 0;
  }

  if (options.force && isPassed) {
    if (!isInteractiveTty()) {
      console.log(
        `Note: Bet '${id}' remains status: passed. To unpass, edit bets/${id}.md and set status: pending.`,
      );
      return 0;
    }

    const result = await maybePromptUnpass(id);
    if (result === "cancel") {
      console.log(`Cancelled; bet '${id}' remains status: passed.`);
      return 0;
    }

    if (result === "unpass") {
      bet.bet.data.status = "pending";
      try {
        await writeBetFile(rootDir, id, bet.bet);
      } catch (error) {
        console.error(`Failed to update bet '${id}' status: ${(error as Error).message}`);
        return 1;
      }
      console.log(`Updated bet '${id}' to status: pending.`);
    }
  }

  return 0;
}
