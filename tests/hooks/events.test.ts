import { parseHookStdin } from "../../src/hooks/events";

describe("parseHookStdin", () => {
  test("parses user prompt submit payload", () => {
    const payload = parseHookStdin(
      JSON.stringify({
        session_id: "sess-1",
        prompt: "work on onboarding",
        cwd: "/repo",
      }),
      "user-prompt-submit",
    );

    expect(payload).toMatchObject({
      sessionId: "sess-1",
      prompt: "work on onboarding",
      cwd: "/repo",
    });
  });

  test("parses post tool payload and stringifies nested tool_input", () => {
    const payload = parseHookStdin(
      JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: "src/a.ts", content: "x" },
        output: { ok: true },
      }),
      "post-tool-use",
    );

    expect(payload?.toolName).toBe("Write");
    expect(payload?.toolInput).toContain("file_path");
    expect(payload?.toolOutput).toContain("ok");
  });

  test("returns null for malformed JSON", () => {
    const payload = parseHookStdin("{oops", "session-end");
    expect(payload).toBeNull();
  });

  test("truncates oversized fields", () => {
    const large = "a".repeat(4000);
    const payload = parseHookStdin(JSON.stringify({ prompt: large }), "user-prompt-submit");

    expect(payload?.prompt?.length).toBeLessThan(2105);
    expect(payload?.prompt?.endsWith("...")).toBe(true);
  });
});
