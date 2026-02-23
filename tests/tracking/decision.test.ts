import { applySelectionDecision } from "../../src/tracking/decision";
import type { SelectionContext } from "../../src/tracking/types";

const context: SelectionContext = {
  event: "post-tool-use",
  payload: null,
  activeBetIds: ["landing-page"],
  bets: [
    { id: "landing-page", status: "pending", summary: "landing" },
    { id: "onboarding-v2", status: "pending", summary: "onboarding" },
  ],
  recentAttribution: [],
};

describe("applySelectionDecision", () => {
  test("no-ops below confidence threshold", async () => {
    const start = jest.fn().mockResolvedValue(0);
    const stop = jest.fn().mockResolvedValue(0);

    const result = await applySelectionDecision(
      context,
      { action: "start", bet_id: "onboarding-v2", confidence: 0.4, reason: "weak" },
      { start, stop },
    );

    expect(result.applied).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  test("applies switch by stopping old and starting new", async () => {
    const start = jest.fn().mockResolvedValue(0);
    const stop = jest.fn().mockResolvedValue(0);

    const result = await applySelectionDecision(
      context,
      {
        action: "switch",
        bet_id: "onboarding-v2",
        stop_bet_id: "landing-page",
        confidence: 0.95,
        reason: "strong",
      },
      { start, stop },
    );

    expect(result.applied).toBe(true);
    expect(stop).toHaveBeenCalledWith("landing-page");
    expect(start).toHaveBeenCalledWith("onboarding-v2");
  });

  test("no-ops on invalid bet ids", async () => {
    const start = jest.fn().mockResolvedValue(0);
    const stop = jest.fn().mockResolvedValue(0);

    const result = await applySelectionDecision(
      context,
      { action: "start", bet_id: "unknown", confidence: 0.9, reason: "bad" },
      { start, stop },
    );

    expect(result.applied).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
