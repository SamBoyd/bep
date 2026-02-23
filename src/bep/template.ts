import matter from "gray-matter";
import type { LeadingIndicator } from "../providers/types";

export type NewBetTemplateInput = {
  id: string;
  createdAt: string;
  leadingIndicator: LeadingIndicator;
  maxHours?: number;
  maxCalendarDays?: number;
  primaryAssumption: string;
  rationale: string;
  validationPlan: string;
  notes: string;
};

export function renderNewBetMarkdown(input: NewBetTemplateInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    status: "pending",
    created_at: input.createdAt,
    leading_indicator: input.leadingIndicator,
  };

  if (typeof input.maxHours === "number") {
    frontmatter.max_hours = input.maxHours;
  }

  if (typeof input.maxCalendarDays === "number") {
    frontmatter.max_calendar_days = input.maxCalendarDays;
  }

  const body = [
    "# Budgeted Engineering Proposal",
    "",
    "## 1. Primary Assumption",
    "",
    input.primaryAssumption,
    "",
    "## 2. Rationale",
    "",
    input.rationale,
    "",
    "## 3. Validation Plan",
    "",
    input.validationPlan,
    "",
    "## 4. Notes",
    "",
    input.notes,
    "",
  ].join("\n");

  return `${matter.stringify(body, frontmatter)}`;
}
