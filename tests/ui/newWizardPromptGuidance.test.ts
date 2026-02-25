import { WIZARD_GUIDANCE_COPY } from "../../src/ui/ink/newWizard/useWizardState.js";

describe("Ink new wizard guidance copy", () => {
  test("defines clear prompt copy for primary assumption", () => {
    expect(WIZARD_GUIDANCE_COPY.primary_assumption).toEqual({
      title: "What must be true for this bet to work?",
      helpText:
        "Write the core assumption you are betting on. Focus on one claim that could be proven wrong.",
      placeholder:
        "Example: Users who start onboarding from the pricing page convert better because they already understand the value.",
    });
  });

  test("defines clear prompt copy for rationale", () => {
    expect(WIZARD_GUIDANCE_COPY.rationale).toEqual({
      title: "Why do you believe this assumption?",
      helpText:
        "Summarize the evidence or reasoning behind the bet (data, user feedback, prior experiments, market signals, etc.).",
      placeholder:
        "Example: Session replays and interviews show pricing-page visitors ask fewer setup questions, and they convert at a higher rate in current funnel data.",
    });
  });

  test("defines clear prompt copy for validation plan", () => {
    expect(WIZARD_GUIDANCE_COPY.validation_plan).toEqual({
      title: "How will you validate whether the bet worked?",
      helpText:
        "Describe the metric(s), comparison, and decision rule you will use. Include what outcome would count as success or failure.",
      placeholder:
        "Example: Compare signup-to-activation rate for users exposed to variant B vs control for 14 days; consider the bet validated if activation improves by >=10% with no drop in trial starts.",
    });
  });
});
