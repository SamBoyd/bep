import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeValidationStatus } from "../bep/status.js";
import { listBetMarkdownFiles, readBetFile } from "../fs/bets.js";
import { LOGS_DIR } from "../fs/init.js";
import { readState } from "../state/state.js";
import type { AttributionHistoryEntry, BetCatalogEntry, HookEvent, ParsedHookPayload, SelectionContext } from "./types.js";

const MAX_BET_SUMMARY_CHARS = 800;
const MAX_HISTORY_ENTRIES = 20;

function summarizeContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_BET_SUMMARY_CHARS) {
    return compact;
  }

  return `${compact.slice(0, MAX_BET_SUMMARY_CHARS)}...`;
}

function extractSection(content: string, heading: string): string | undefined {
  const pattern = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = content.match(pattern);
  if (!match || !match[1]) {
    return undefined;
  }

  return summarizeContent(match[1]);
}

function extractSectionAny(content: string, headings: string[]): string | undefined {
  for (const heading of headings) {
    const value = extractSection(content, heading);
    if (value) {
      return value;
    }
  }

  return undefined;
}

async function readBetCatalog(rootDir: string): Promise<BetCatalogEntry[]> {
  const files = await listBetMarkdownFiles(rootDir);

  const result: BetCatalogEntry[] = [];
  for (const fileName of files) {
    try {
      const parsed = await readBetFile(rootDir, fileName);
      const id = String(parsed.bet.data.id ?? fileName.replace(/\.md$/, ""));
      const status = normalizeValidationStatus(parsed.bet.data.status);
      const content = parsed.bet.content || "";

      result.push({
        id,
        status,
        assumption: extractSection(content, "1\\. Primary Assumption"),
        validationPlan: extractSectionAny(content, ["2\\. Validation Plan", "3\\. Validation Plan"]),
        notes: extractSectionAny(content, ["3\\. Notes", "4\\. Notes"]),
        summary: summarizeContent(content),
      });
    } catch {
      // Skip malformed bet files for inference context; do not block hook processing.
    }
  }

  return result;
}

async function readRecentAttribution(rootDir: string): Promise<AttributionHistoryEntry[]> {
  const filePath = path.join(rootDir, LOGS_DIR, "agent-attribution.jsonl");

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return [];
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const recent = lines.slice(-MAX_HISTORY_ENTRIES);
  const parsed: AttributionHistoryEntry[] = [];

  for (const line of recent) {
    try {
      const value = JSON.parse(line) as AttributionHistoryEntry;
      parsed.push(value);
    } catch {
      // Ignore malformed history entries.
    }
  }

  return parsed;
}

export async function buildBetSelectionContext(
  rootDir: string,
  event: HookEvent,
  payload: ParsedHookPayload | null,
): Promise<SelectionContext> {
  const [state, bets, recentAttribution] = await Promise.all([
    readState(rootDir),
    readBetCatalog(rootDir),
    readRecentAttribution(rootDir),
  ]);

  return {
    event,
    payload,
    activeBetIds: state.active.map((session) => session.id),
    bets,
    recentAttribution,
  };
}
