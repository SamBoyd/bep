import { classifyTextSubmission, getInitialSelectIndex } from "../../src/ui/ink/newWizard/promptUtils.js";

describe("ink new wizard prompt utils", () => {
  test("maps initial select value to matching index", () => {
    const index = getInitialSelectIndex(
      [
        { label: "Back", value: "__back__" },
        { label: "Manual", value: "manual" },
      ],
      "manual",
    );

    expect(index).toBe(1);
  });

  test("returns validation error for invalid submission", () => {
    const result = classifyTextSubmission("", {
      validate: () => "Enter a value.",
    });

    expect(result).toEqual({ kind: "invalid", message: "Enter a value." });
  });

  test("returns raw value when valid", () => {
    const result = classifyTextSubmission("  keep raw  ", {
      validate: () => undefined,
    });

    expect(result).toEqual({ kind: "value", value: "  keep raw  " });
  });
});
