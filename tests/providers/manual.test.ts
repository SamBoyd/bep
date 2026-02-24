await jest.unstable_mockModule("../../src/ui/checkPrompt.js", () => ({
  runCheckPrompt: jest.fn(),
}));

const { manualAdapter, parseManualLeadingIndicator } = await import("../../src/providers/manual.js");
const { runCheckPrompt } = await import("../../src/ui/checkPrompt.js");

const mockedRunCheckPrompt = runCheckPrompt as jest.MockedFunction<typeof runCheckPrompt>;

describe("manual provider parse", () => {
  test("parses valid manual indicator", () => {
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

  test("rejects invalid operator", () => {
    const result = parseManualLeadingIndicator({
      type: "manual",
      operator: "nope",
      target: 20,
    });

    expect(result).toEqual({
      ok: false,
      error: 'leading_indicator.operator must be one of "lt", "lte", "eq", "gte", "gt".',
    });
  });
});

describe("manual adapter", () => {
  beforeEach(() => {
    mockedRunCheckPrompt.mockReset();
  });

  test("runCheck returns normalized result shape", async () => {
    mockedRunCheckPrompt.mockResolvedValue({
      cancelled: false,
      observedValue: 21,
      notes: "manual check",
    });

    const indicator = { type: "manual" as const, operator: "gte" as const, target: 20 };
    const result = await manualAdapter.runCheck(indicator, {
      rootDir: "/tmp",
      betId: "landing-page",
      nowIso: "2026-02-18T00:00:00.000Z",
    });

    expect(result).toEqual({
      observedValue: 21,
      meetsTarget: true,
      notes: "manual check",
    });
  });

});
