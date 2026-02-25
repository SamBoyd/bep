import { TextStep } from "../../src/ui/ink/newWizard/components/TextStep.tsx";
import type { TextPromptRequest } from "../../src/ui/ink/newWizard/types.js";

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

describe("TextStep", () => {
  test("renders placeholder text when input is empty", () => {
    const prompt: TextPromptRequest = {
      title: "Example prompt",
      placeholder: "Example: Good input",
    };

    const tree = TextStep({ prompt, value: "" });
    const text = flattenText(tree);

    expect(text).toContain("Example: Good input");
  });

  test("renders entered value instead of placeholder", () => {
    const prompt: TextPromptRequest = {
      title: "Example prompt",
      placeholder: "Example: Good input",
    };

    const tree = TextStep({ prompt, value: "Real answer" });
    const text = flattenText(tree);

    expect(text).toContain("Real answer");
    expect(text).not.toContain("Example: Good input");
  });

  test("preserves behavior for empty prompts without a placeholder", () => {
    const prompt: TextPromptRequest = {
      title: "Example prompt",
      optional: true,
    };

    const tree = TextStep({ prompt, value: "" });
    const text = flattenText(tree);

    expect(text).toContain("Optional field.");
    expect(text).not.toContain("undefined");
  });
});
