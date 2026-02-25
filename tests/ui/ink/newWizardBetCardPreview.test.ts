import { buildBetCardPreviewModel } from "../../../src/ui/ink/newWizard/betCardPreview.ts";
import {
  applySelectStepValue,
  applyTextStepValue,
  createInitialWizardDraft,
} from "../../../src/ui/ink/newWizard/flow.ts";
import type { SelectPromptRequest, TextPromptRequest } from "../../../src/ui/ink/newWizard/types.js";
import type { WizardUiState } from "../../../src/ui/ink/newWizard/useWizardState.js";

function textUiState(textValue: string): WizardUiState {
  return {
    textValue,
    selectIndex: 0,
    error: undefined,
  };
}

function selectUiState(selectIndex: number): WizardUiState {
  return {
    textValue: "",
    selectIndex,
    error: undefined,
  };
}

describe("buildBetCardPreviewModel", () => {
  test("renders placeholders and registered providers for empty state", () => {
    const prompt: TextPromptRequest = {
      title: "Bet name",
    };

    const model = buildBetCardPreviewModel({
      draft: createInitialWizardDraft(),
      step: "bet_name",
      prompt,
      uiState: textUiState(""),
      providerTypes: ["manual", "mixpanel"],
    });

    expect(model.betName.empty).toBe(true);
    expect(model.betName.value).toContain("Not entered");
    expect(model.providers.map((provider) => provider.type)).toEqual(["manual", "mixpanel"]);
    expect(model.capSummary).toContain("Set time cap");
    expect(model.validationRuleSummary).toContain("Select a provider");
  });

  test("uses live text buffer for bet name preview before submission", () => {
    const prompt: TextPromptRequest = {
      title: "Bet name",
    };
    const draft = createInitialWizardDraft();

    const model = buildBetCardPreviewModel({
      draft,
      step: "bet_name",
      prompt,
      uiState: textUiState("Landing Page Test"),
      providerTypes: ["manual", "mixpanel"],
    });

    expect(model.betName.value).toBe("Landing Page Test");
    expect(model.betName.empty).toBe(false);
  });

  test("uses highlighted provider on select step before submit", () => {
    const prompt: SelectPromptRequest = {
      title: "Provider",
      options: [
        { label: "manual", value: "manual" },
        { label: "mixpanel", value: "mixpanel" },
      ],
    };
    const draft = createInitialWizardDraft();

    const model = buildBetCardPreviewModel({
      draft,
      step: "leading_indicator_type",
      prompt,
      uiState: selectUiState(1),
      providerTypes: ["manual", "mixpanel"],
    });

    expect(model.selectedProviderType).toBe("mixpanel");
    expect(model.providers.find((provider) => provider.type === "mixpanel")?.selected).toBe(true);
    expect(model.providerConfigFields.map((field) => field.label)).toContain("workspace id");
  });

  test("renders mixpanel config and cap summary with in-progress values", () => {
    let draft = createInitialWizardDraft();
    draft = applySelectStepValue(draft, "leading_indicator_type", "mixpanel");
    draft = applyTextStepValue(draft, "mixpanel_project_id", "123");
    draft = applyTextStepValue(draft, "mixpanel_workspace_id", "456");
    draft = applyTextStepValue(draft, "mixpanel_bookmark_id", "789");
    draft = applySelectStepValue(draft, "mixpanel_operator", "gt");
    draft = applySelectStepValue(draft, "cap_type", "max_calendar_days");

    const prompt: TextPromptRequest = {
      title: "Mixpanel target",
    };

    const model = buildBetCardPreviewModel({
      draft,
      step: "mixpanel_target",
      prompt,
      uiState: textUiState("42"),
      providerTypes: ["manual", "mixpanel"],
    });

    expect(model.validationRuleSummary).toBe("Mixpanel metric > 42");
    expect(model.capSummary).toBe("Set time cap type and value");

    const withCapPrompt: TextPromptRequest = { title: "Cap value" };
    const withCapModel = buildBetCardPreviewModel({
      draft,
      step: "cap_value",
      prompt: withCapPrompt,
      uiState: textUiState("14"),
      providerTypes: ["manual", "mixpanel"],
    });

    expect(withCapModel.capSummary).toBe("14 calendar days");
  });

  test("keeps in-progress text visible even when ui state has an error", () => {
    const prompt: TextPromptRequest = {
      title: "Assumption",
    };
    const uiState: WizardUiState = {
      textValue: "Users convert faster from pricing page",
      selectIndex: 0,
      error: "Example error",
    };

    const model = buildBetCardPreviewModel({
      draft: createInitialWizardDraft(),
      step: "primary_assumption",
      prompt,
      uiState,
      providerTypes: ["manual", "mixpanel"],
    });

    expect(model.primaryAssumption.value).toContain("Users convert faster");
    expect(model.primaryAssumption.empty).toBe(false);
  });
});
