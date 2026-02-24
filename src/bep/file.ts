import type { LeadingIndicator } from "../providers/types.js";

export type BetStatus = "pending" | "passed" 

export type BetFrontmatter = {
  id?: string;
  status?: BetStatus;
  created_at?: string | Date;
  leading_indicator?: LeadingIndicator | Record<string, unknown>;
  max_hours?: number;
  max_calendar_days?: number;
} & Record<string, unknown>;

export type BetFile = {
  content: string;
  data: BetFrontmatter;
};
