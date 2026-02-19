import type { DefaultAction } from "./template";
import type { LeadingIndicator } from "../providers/types";

export type BetStatus = "active" | "paused" | "unknown" | (string & {});

export type BetFrontmatter = {
  id?: string;
  status?: BetStatus;
  default_action?: DefaultAction;
  created_at?: string | Date;
  leading_indicator?: LeadingIndicator | Record<string, unknown>;
  max_hours?: number;
  max_calendar_days?: number;
} & Record<string, unknown>;

export type BetFile = {
  content: string;
  data: BetFrontmatter;
};
