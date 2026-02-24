import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { selectBetWithClaude } from "../../src/tracking/selector.js";
import type { SelectionContext } from "../../src/tracking/types.js";

const baseContext: SelectionContext = {
  event: "user-prompt-submit",
  payload: {
    prompt: "work on onboarding",
    raw: {},
  },
  activeBetIds: ["landing-page"],
  bets: [
    { id: "landing-page", status: "pending", summary: "landing work" },
    { id: "onboarding-v2", status: "pending", summary: "onboarding" },
  ],
  recentAttribution: [],
};

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "bep-selector-debug-test-"));
}

describe("selectBetWithClaude", () => {
  test("session-end prompt includes explicit stop-first policy and keep warning", async () => {
    const context: SelectionContext = {
      ...baseContext,
      event: "session-end",
      activeBetIds: ["landing-page"],
    };

    let capturedPrompt = "";
    const result = await selectBetWithClaude(context, async ({ prompt }) => {
      capturedPrompt = prompt;
      return JSON.stringify({
        action: "stop",
        bet_id: "landing-page",
        confidence: 0.9,
        reason: "session ended",
      });
    });

    expect(result.ok).toBe(true);
    expect(capturedPrompt).toContain("Event-specific policy for session-end:");
    expect(capturedPrompt).toContain("prefer action 'stop'");
    expect(capturedPrompt).toContain("Action 'keep' is generally incorrect");
    expect(capturedPrompt).toContain("Use action 'none' only when no active/inferable bet can be identified.");
  });

  test("user-prompt-submit prompt includes minimal start/switch intent guidance", async () => {
    let capturedPrompt = "";
    const result = await selectBetWithClaude(baseContext, async ({ prompt }) => {
      capturedPrompt = prompt;
      return JSON.stringify({
        action: "start",
        bet_id: "onboarding-v2",
        confidence: 0.81,
        reason: "explicit work intent",
      });
    });

    expect(result.ok).toBe(true);
    expect(capturedPrompt).toContain("Event-specific policy for user-prompt-submit:");
    expect(capturedPrompt).toContain("Use 'start' or 'switch' only when intent is explicit or strongly inferred.");
  });

  test("prompt preserves strict JSON-only output instruction", async () => {
    let capturedPrompt = "";
    const result = await selectBetWithClaude(
      { ...baseContext, event: "post-tool-use" },
      async ({ prompt }) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          action: "none",
          confidence: 0.8,
          reason: "insufficient evidence",
        });
      },
    );

    expect(result.ok).toBe(true);
    expect(capturedPrompt).toContain("Return only one JSON object. Do not include markdown fences, commentary, or extra keys.");
    expect(capturedPrompt).toContain("Required JSON schema:");
  });

  test("accepts direct JSON decision", async () => {
    const result = await selectBetWithClaude(baseContext, async () =>
      JSON.stringify({ action: "switch", bet_id: "onboarding-v2", stop_bet_id: "landing-page", confidence: 0.9, reason: "strong match" }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.action).toBe("switch");
      expect(result.decision.bet_id).toBe("onboarding-v2");
    }
  });

  test("accepts Claude envelope with JSON in result", async () => {
    const result = await selectBetWithClaude(baseContext, async () =>
      JSON.stringify({ result: '{"action":"start","bet_id":"onboarding-v2","confidence":0.8,"reason":"match"}' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.action).toBe("start");
    }
  });

  test("accepts Claude array envelope using result event payload", async () => {
    const result = await selectBetWithClaude(baseContext, async () =>
      JSON.stringify([
        { type: "system", subtype: "init" },
        {
          type: "result",
          result: '{"action":"start","bet_id":"onboarding-v2","confidence":0.91,"reason":"clear signal"}',
        },
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.action).toBe("start");
      expect(result.decision.bet_id).toBe("onboarding-v2");
    }
  });

  test("accepts Claude array envelope using assistant text fallback", async () => {
    const result = await selectBetWithClaude(baseContext, async () =>
      JSON.stringify([
        { type: "system", subtype: "init" },
        {
          type: "assistant",
          message: {
            content: [
              {
                type: "text",
                text: '{"action":"switch","bet_id":"onboarding-v2","stop_bet_id":"landing-page","confidence":0.85,"reason":"context shift"}',
              },
            ],
          },
        },
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.action).toBe("switch");
      expect(result.decision.stop_bet_id).toBe("landing-page");
    }
  });

  test("fails when Claude array envelope has no decision payload", async () => {
    const result = await selectBetWithClaude(baseContext, async () =>
      JSON.stringify([{ type: "system", subtype: "init" }]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("array envelope did not include a decision payload");
    }
  });

  test("fails schema validation for unknown bet id", async () => {
    const result = await selectBetWithClaude(baseContext, async () =>
      JSON.stringify({ action: "start", bet_id: "unknown", confidence: 0.9, reason: "bad" }),
    );

    expect(result.ok).toBe(false);
  });

  test("fails when runner throws", async () => {
    const result = await selectBetWithClaude(baseContext, async () => {
      throw new Error("missing claude");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Failed to run Claude selector");
    }
  });

  test("writes debug log entries on success when debug path is provided", async () => {
    const tempDir = await createTempDir();

    try {
      const debugLogPath = path.join(tempDir, "hook_debug.log");
      const result = await selectBetWithClaude(
        baseContext,
        async () => JSON.stringify({ action: "start", bet_id: "onboarding-v2", confidence: 0.9, reason: "clear" }),
        { debugLogPath },
      );

      expect(result.ok).toBe(true);
      const raw = await readFile(debugLogPath, "utf8");
      expect(raw).toContain("\"stage\":\"build_prompt\"");
      expect(raw).toContain("\"stage\":\"return_ok\"");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("writes debug return_error entry on non-JSON output", async () => {
    const tempDir = await createTempDir();

    try {
      const debugLogPath = path.join(tempDir, "hook_debug.log");
      const result = await selectBetWithClaude(baseContext, async () => "plain text", { debugLogPath });

      expect(result.ok).toBe(false);
      const raw = await readFile(debugLogPath, "utf8");
      expect(raw).toContain("\"stage\":\"return_error\"");
      expect(raw).toContain("plain text");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("debug write failure does not break selector behavior", async () => {
    const unwritablePath = "/definitely/missing/path/hook_debug.log";
    const result = await selectBetWithClaude(
      baseContext,
      async () => JSON.stringify({ action: "start", bet_id: "onboarding-v2", confidence: 0.8, reason: "ok" }),
      { debugLogPath: unwritablePath },
    );

    expect(result.ok).toBe(true);
  });

  test("logs policy mismatch warning when session-end returns keep", async () => {
    const tempDir = await createTempDir();
    const context: SelectionContext = {
      ...baseContext,
      event: "session-end",
      activeBetIds: ["landing-page"],
    };

    try {
      const debugLogPath = path.join(tempDir, "hook_debug.log");
      const result = await selectBetWithClaude(
        context,
        async () =>
          JSON.stringify({
            action: "keep",
            bet_id: "landing-page",
            confidence: 0.9,
            reason: "model chose keep",
          }),
        { debugLogPath },
      );

      expect(result.ok).toBe(true);
      const raw = await readFile(debugLogPath, "utf8");
      expect(raw).toContain("Session-end returned keep; this conflicts with preferred stop policy.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
