import matter from "gray-matter";
import type { ManualLeadingIndicator } from "./checkInput";

export type DefaultAction = "kill" | "narrow" | "pivot" | "extend";

export type NewBetTemplateInput = {
  id: string;
  createdAt: string;
  defaultAction: DefaultAction;
  leadingIndicator: ManualLeadingIndicator;
  maxHours?: number;
  maxCalendarDays?: number;
};

export function renderNewBetMarkdown(input: NewBetTemplateInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    status: "active",
    default_action: input.defaultAction,
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
    "## 2. Rationale",
    "",
    "## 3. Validation Plan",
    "",
    "## 4. Notes",
    "",
  ].join("\n");

  return `${matter.stringify(body, frontmatter)}`;
}
