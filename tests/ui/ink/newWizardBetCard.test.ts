import { BetCard } from "../../../src/ui/ink/newWizard/components/BetCard.tsx";
import type { BetCardPreviewModel } from "../../../src/ui/ink/newWizard/betCardPreview.js";

function flattenText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => flattenText(child)).join("");
  }

  if (typeof node === "object" && "props" in node) {
    return flattenText((node as { props?: { children?: unknown } }).props?.children);
  }

  return "";
}

describe("BetCard", () => {
  test("renders sketch fields, provider config, validation rule, and cap summary", () => {
    const model: BetCardPreviewModel = {
      betName: { label: "Bet name", value: "landing_page_test", empty: false },
      primaryAssumption: { value: "Users arriving from pricing are more qualified.", empty: false },
      validationPlan: { value: "Compare activation rate uplift vs control for 14 days.", empty: false },
      providers: [
        { type: "manual", label: "Manual", selected: false },
        { type: "mixpanel", label: "Mixpanel", selected: true },
      ],
      selectedProviderType: "mixpanel",
      providerConfigTitle: "Config",
      providerConfigFields: [
        { label: "workspace id", value: "4485331", empty: false },
        { label: "project id", value: "3989556", empty: false },
        { label: "bookmark id", value: "88319528", empty: false },
        { label: "operator", value: ">", empty: false },
        { label: "target", value: "10", empty: false },
      ],
      validationRuleSummary: "Mixpanel metric > 10",
      capSummary: "14 calendar days",
    };

    const tree = BetCard({ model });
    const text = flattenText(tree);

    expect(text).toContain("Bet Card Preview");
    expect(text).toContain("landing_page_test");
    expect(text).toContain("Manual");
    expect(text).toContain("Mixpanel");
    expect(text).toContain("Validation passes when:");
    expect(text).toContain("Mixpanel metric > 10");
    expect(text).toContain("Exposure cap:");
    expect(text).toContain("14 calendar days");
    expect(text).not.toContain("undefined");
  });
});
