import matter from "gray-matter";
import { renderNewBetMarkdown } from "../../src/bep/template";

describe("renderNewBetMarkdown", () => {
  test("includes required frontmatter fields", () => {
    const markdown = renderNewBetMarkdown({
      id: "landing-page",
      createdAt: "2026-02-18T00:00:00.000Z",
      defaultAction: "kill",
      leadingIndicator: {
        type: "manual",
        target: ">= 20 signups in 7d",
      },
    });

    const parsed = matter(markdown);
    expect(parsed.data).toEqual({
      id: "landing-page",
      status: "active",
      default_action: "kill",
      created_at: "2026-02-18T00:00:00.000Z",
      leading_indicator: {
        type: "manual",
        target: ">= 20 signups in 7d",
      },
    });
    expect(parsed.content).toContain("# Budgeted Engineering Proposal");
  });

  test("omits optional fields when not provided", () => {
    const markdown = renderNewBetMarkdown({
      id: "onboarding-v2",
      createdAt: "2026-02-18T00:00:00.000Z",
      defaultAction: "pivot",
      leadingIndicator: {
        type: "manual",
        target: ">= 10 activations",
      },
    });

    const parsed = matter(markdown);
    expect(parsed.data).not.toHaveProperty("max_hours");
    expect(parsed.data).not.toHaveProperty("max_calendar_days");
    expect(parsed.data).toHaveProperty("leading_indicator");
  });

  test("includes optional cap fields when provided", () => {
    const markdown = renderNewBetMarkdown({
      id: "onboarding-v2",
      createdAt: "2026-02-18T00:00:00.000Z",
      defaultAction: "extend",
      leadingIndicator: {
        type: "manual",
        target: ">= 50 demos booked",
      },
      maxHours: 12,
      maxCalendarDays: 10,
    });

    const parsed = matter(markdown);
    expect(parsed.data).toMatchObject({
      max_hours: 12,
      max_calendar_days: 10,
    });
  });
});
