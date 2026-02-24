import path from "node:path";
import { resolveHookCommandBase } from "../../src/hooks/install.js";

describe("resolveHookCommandBase", () => {
  test("resolves relative argv path against startDir", () => {
    const originalArgv1 = process.argv[1];

    try {
      process.argv[1] = "dist/cli.js";
      expect(resolveHookCommandBase("/tmp/repo")).toBe("/tmp/repo/dist/cli.js");
    } finally {
      process.argv[1] = originalArgv1 ?? "";
    }
  });

  test("quotes paths with spaces", () => {
    const originalArgv1 = process.argv[1];

    try {
      process.argv[1] = path.join("dist dir", "cli.js");
      expect(resolveHookCommandBase("/tmp/repo")).toBe("'/tmp/repo/dist dir/cli.js'");
    } finally {
      process.argv[1] = originalArgv1 ?? "";
    }
  });

  test("falls back to bep when argv is missing", () => {
    const originalArgv1 = process.argv[1];

    try {
      (process.argv as unknown as Array<string | undefined>)[1] = undefined;
      expect(resolveHookCommandBase("/tmp/repo")).toBe("bep");
    } finally {
      process.argv[1] = originalArgv1 ?? "";
    }
  });
});
