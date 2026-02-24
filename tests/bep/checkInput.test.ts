import { evaluateManualComparison, parseManualLeadingIndicator } from "../../src/bep/checkInput.js";

describe("parseManualLeadingIndicator", () => {
  test("parses a valid manual indicator", () => {
    const result = parseManualLeadingIndicator({
      type: "manual",
      operator: "gte",
      target: 20,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        type: "manual",
        operator: "gte",
        target: 20,
      },
    });
  });

  test("rejects missing operator", () => {
    const result = parseManualLeadingIndicator({
      type: "manual",
      target: 20,
    });

    expect(result).toEqual({
      ok: false,
      error: 'leading_indicator.operator must be one of "lt", "lte", "eq", "gte", "gt".',
    });
  });
});

describe("evaluateManualComparison", () => {
  test("evaluates supported operators", () => {
    expect(evaluateManualComparison(10, "lt", 20)).toBe(true);
    expect(evaluateManualComparison(20, "lte", 20)).toBe(true);
    expect(evaluateManualComparison(20, "eq", 20)).toBe(true);
    expect(evaluateManualComparison(20, "gte", 20)).toBe(true);
    expect(evaluateManualComparison(30, "gt", 20)).toBe(true);
  });
});
