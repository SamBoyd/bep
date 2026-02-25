import type { LeadingIndicator } from "../providers/types.js";

export type OptionalNumberField = "max_hours" | "max_calendar_days";

export type NewWizardValues = {
  betName: string;
  maxHours?: number;
  maxCalendarDays?: number;
  leadingIndicator: LeadingIndicator;
  primaryAssumption: string;
  validationPlan: string;
  notes: string;
};

export type NewWizardOptions = {
  initialBetName?: string;
  validateBetName: (normalizedName: string) => string | undefined;
};

export type NewWizardResult = { cancelled: true } | { cancelled: false; values: NewWizardValues };
