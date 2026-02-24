import { readFile } from "node:fs/promises";
import path from "node:path";
import { isValidBetId } from "../bep/id.js";
import { pathExists, readBetFile } from "../fs/bets.js";
import { LOGS_DIR } from "../fs/init.js";
import type { SelectionContext, SelectionDecision } from "./types.js";

export type CapType = "max_hours" | "max_calendar_days";

export type CapGateResult = {
  targetBetId?: string;
  capType?: CapType;
  capValue?: number;
  usedValue?: number;
  percentUsed?: number;
  overCap: boolean;
  reason: string;
};

type Exposure = {
  hours: number;
  calendarDays: number | null;
};

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseCreatedAtMs(value: unknown): number | null {
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

async function sumLoggedExposureSeconds(rootDir: string, betId: string): Promise<number> {
  const relativePath = path.join(LOGS_DIR, `${betId}.jsonl`);
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
      throw new Error(`invalid_json_line_${index + 1}`);
    }

    const duration = (parsed as { duration_seconds?: unknown }).duration_seconds;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
      throw new Error(`invalid_duration_line_${index + 1}`);
    }

    total += duration;
  }

  return total;
}

export async function calculateExposureForBet(rootDir: string, betId: string, createdAt: unknown): Promise<Exposure> {
  const seconds = await sumLoggedExposureSeconds(rootDir, betId);
  const hours = seconds / 3600;

  const createdAtMs = parseCreatedAtMs(createdAt);
  if (createdAtMs === null) {
    return {
      hours,
      calendarDays: null,
    };
  }

  const calendarDays = Math.max(0, (Date.now() - createdAtMs) / (24 * 60 * 60 * 1000));
  return {
    hours,
    calendarDays,
  };
}

export function selectGateTargetBet(context: SelectionContext, decision: SelectionDecision): string | null {
  if (decision.bet_id && isValidBetId(decision.bet_id)) {
    return decision.bet_id;
  }

  if (decision.action === "switch" && decision.bet_id && isValidBetId(decision.bet_id)) {
    return decision.bet_id;
  }

  if (context.activeBetIds.length === 1) {
    const active = context.activeBetIds[0];
    return isValidBetId(active) ? active : null;
  }

  return null;
}

export async function evaluateCapGate(
  rootDir: string,
  context: SelectionContext,
  decision: SelectionDecision,
): Promise<CapGateResult> {
  const targetBetId = selectGateTargetBet(context, decision);
  if (!targetBetId) {
    return {
      overCap: false,
      reason: "no_target_bet",
    };
  }

  const catalogEntry = context.bets.find((bet) => bet.id === targetBetId);
  if (catalogEntry?.status === "passed") {
    return {
      targetBetId,
      overCap: false,
      reason: "bet_passed",
    };
  }

  let bet;
  try {
    bet = (await readBetFile(rootDir, targetBetId)).bet;
  } catch {
    return {
      targetBetId,
      overCap: false,
      reason: "target_bet_unreadable",
    };
  }

  const maxHours = parsePositiveNumber(bet.data.max_hours);
  const maxCalendarDays = maxHours === null ? parsePositiveNumber(bet.data.max_calendar_days) : null;

  if (maxHours === null && maxCalendarDays === null) {
    return {
      targetBetId,
      overCap: false,
      reason: "no_cap_configured",
    };
  }

  let exposure: Exposure;
  try {
    exposure = await calculateExposureForBet(rootDir, targetBetId, bet.data.created_at);
  } catch (error) {
    return {
      targetBetId,
      overCap: false,
      reason: `cap_eval_failed:${(error as Error).message}`,
    };
  }

  if (maxHours !== null) {
    const usedValue = exposure.hours;
    const percentUsed = (usedValue / maxHours) * 100;
    return {
      targetBetId,
      capType: "max_hours",
      capValue: maxHours,
      usedValue,
      percentUsed,
      overCap: percentUsed >= 100,
      reason: percentUsed >= 100 ? "at_or_over_cap" : "under_cap",
    };
  }

  const usedValue = exposure.calendarDays;
  if (usedValue === null || maxCalendarDays === null) {
    return {
      targetBetId,
      capType: "max_calendar_days",
      capValue: maxCalendarDays ?? undefined,
      overCap: false,
      reason: "calendar_cap_missing_created_at",
    };
  }

  const percentUsed = (usedValue / maxCalendarDays) * 100;
  return {
    targetBetId,
    capType: "max_calendar_days",
    capValue: maxCalendarDays,
    usedValue,
    percentUsed,
    overCap: percentUsed >= 100,
    reason: percentUsed >= 100 ? "at_or_over_cap" : "under_cap",
  };
}
