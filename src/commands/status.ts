import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { formatManualComparisonOperator } from "../providers/manual";
import { pathExists, readBetFile } from "../fs/bets";
import { BETS_DIR, EVIDENCE_DIR, LOGS_DIR, ensureInitializedRepo } from "../fs/init";
import { readState } from "../state/state";

type StatusRow = {
  id: string;
  status: string;
  active: string;
  exposureHours: string;
  cap: string;
  capPercent: string;
  warning: string;
  validation: string;
};

type ValidationSnapshot = {
  meets_target?: unknown;
  observed_value?: unknown;
  leading_indicator?: unknown;
};

const STATUS_COLUMNS: Array<keyof StatusRow> = [
  "id",
  "status",
  "active",
  "exposureHours",
  "cap",
  "capPercent",
  "warning",
  "validation",
];

const STATUS_HEADERS: Record<keyof StatusRow, string> = {
  id: "id",
  status: "status",
  active: "active",
  exposureHours: "exposure_h",
  cap: "cap",
  capPercent: "cap_%",
  warning: "warning",
  validation: "validation",
};

function formatHours(value: number): string {
  return value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function parseMaxHours(frontmatter: Record<string, unknown>): number | null {
  const value = frontmatter.max_hours;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseMaxCalendarDays(frontmatter: Record<string, unknown>): number | null {
  const value = frontmatter.max_calendar_days;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseCreatedAtMs(frontmatter: Record<string, unknown>): number | null {
  const value = frontmatter.created_at;
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isNaN(millis) ? null : millis;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const millis = Date.parse(value);
  if (Number.isNaN(millis)) {
    return null;
  }

  return millis;
}

function formatValidation(snapshot: ValidationSnapshot): string {
  const meetsTarget = snapshot.meets_target;
  const observedValue = snapshot.observed_value;
  const leadingIndicator = snapshot.leading_indicator;

  if (typeof meetsTarget !== "boolean" || typeof observedValue !== "number" || !Number.isFinite(observedValue)) {
    return "N/A";
  }

  const resultLabel = meetsTarget ? "PASS" : "FAIL";
  if (!leadingIndicator || typeof leadingIndicator !== "object") {
    return `${resultLabel} ${observedValue}`;
  }

  const candidate = leadingIndicator as { type?: unknown; operator?: unknown; target?: unknown };
  if (
    (candidate.type === "manual" || candidate.type === "mixpanel") &&
    typeof candidate.target === "number" &&
    Number.isFinite(candidate.target) &&
    (candidate.operator === "lt" ||
      candidate.operator === "lte" ||
      candidate.operator === "eq" ||
      candidate.operator === "gte" ||
      candidate.operator === "gt")
  ) {
    return `${resultLabel} ${observedValue} ${formatManualComparisonOperator(candidate.operator)} ${candidate.target}`;
  }

  return `${resultLabel} ${observedValue}`;
}

async function sumLoggedExposureSeconds(rootDir: string, id: string): Promise<number> {
  const relativePath = path.join(LOGS_DIR, `${id}.jsonl`);
  const absolutePath = path.join(rootDir, relativePath);
  if (!(await pathExists(absolutePath))) {
    return 0;
  }

  const raw = await readFile(absolutePath, "utf8");
  if (raw.trim().length === 0) {
    return 0;
  }

  let total = 0;
  const lines = raw.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`Failed to parse log file at ${relativePath}: invalid JSON on line ${index + 1}.`);
    }

    const duration = (parsed as { duration_seconds?: unknown }).duration_seconds;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
      throw new Error(
        `Failed to parse log file at ${relativePath}: missing numeric duration_seconds on line ${index + 1}.`,
      );
    }

    total += duration;
  }

  return total;
}

async function readValidationLabel(rootDir: string, id: string): Promise<string> {
  const relativePath = path.join(EVIDENCE_DIR, `${id}.json`);
  const absolutePath = path.join(rootDir, relativePath);
  if (!(await pathExists(absolutePath))) {
    return "N/A";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse evidence file at ${relativePath}: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    return "N/A";
  }

  return formatValidation(parsed as ValidationSnapshot);
}

function renderStatusTable(rows: StatusRow[]): string {
  const matrix = [
    STATUS_COLUMNS.map((column) => STATUS_HEADERS[column]),
    ...rows.map((row) => STATUS_COLUMNS.map((column) => row[column])),
  ];

  const widths = STATUS_COLUMNS.map((_column, columnIndex) =>
    matrix.reduce((max, currentRow) => Math.max(max, currentRow[columnIndex].length), 0),
  );

  const rendered = matrix.map((row) => row.map((cell, index) => cell.padEnd(widths[index])).join("  "));
  return rendered.join("\n");
}

export async function runStatus(): Promise<number> {
  let rootDir: string;
  try {
    const cwd = process.cwd();
    ({ rootDir } = await ensureInitializedRepo(cwd));
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const betDir = path.join(rootDir, BETS_DIR);

  let dirEntries;
  try {
    dirEntries = await readdir(betDir, { withFileTypes: true });
  } catch (error) {
    console.error(`Failed to read bets directory at ${BETS_DIR}: ${(error as Error).message}`);
    return 1;
  }

  const betFiles = dirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (betFiles.length === 0) {
    console.log("No bets found.");
    return 0;
  }

  let activeBetIds: Set<string>;
  try {
    const state = await readState(rootDir);
    activeBetIds = new Set(state.active.map((session) => session.id));
  } catch (error) {
    console.error(`Failed to read state file at bets/_state.json: ${(error as Error).message}`);
    return 1;
  }

  const rows: StatusRow[] = [];
  const nowMs = Date.now();
  for (const fileName of betFiles) {
    const id = fileName.slice(0, -".md".length);
    let bet;
    try {
      bet = (await readBetFile(rootDir, fileName)).bet;
    } catch (error) {
      console.error((error as Error).message);
      return 1;
    }

    let exposureSeconds: number;
    try {
      exposureSeconds = await sumLoggedExposureSeconds(rootDir, id);
    } catch (error) {
      console.error((error as Error).message);
      return 1;
    }

    let validationLabel: string;
    try {
      validationLabel = await readValidationLabel(rootDir, id);
    } catch (error) {
      console.error((error as Error).message);
      return 1;
    }

    const frontmatter = bet.data;
    const status = typeof frontmatter.status === "string" ? frontmatter.status : "unknown";
    const maxHours = parseMaxHours(frontmatter);
    const maxCalendarDays = maxHours === null ? parseMaxCalendarDays(frontmatter) : null;
    const createdAtMs = maxCalendarDays === null ? null : parseCreatedAtMs(frontmatter);
    const exposureHours = exposureSeconds / 3600;
    let cap = "-";
    let capPercent: number | null = null;

    if (maxHours !== null) {
      cap = `${formatHours(maxHours)}h`;
      capPercent = (exposureHours / maxHours) * 100;
    } else if (maxCalendarDays !== null) {
      cap = `${maxCalendarDays.toFixed(2)}d`;
      if (createdAtMs !== null) {
        const elapsedCalendarDays = Math.max(0, (nowMs - createdAtMs) / (24 * 60 * 60 * 1000));
        capPercent = (elapsedCalendarDays / maxCalendarDays) * 100;
      }
    }

    const warning = capPercent === null ? "-" : capPercent >= 100 ? "AT_CAP" : capPercent >= 70 ? "NEARING_CAP" : "-";

    rows.push({
      id,
      status,
      active: activeBetIds.has(id) ? "yes" : "no",
      exposureHours: formatHours(exposureHours),
      cap,
      capPercent: capPercent === null ? "-" : formatPercent(capPercent),
      warning,
      validation: validationLabel,
    });
  }

  console.log(renderStatusTable(rows));
  return 0;
}
