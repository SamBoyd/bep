import matter from "gray-matter";
import { renderNewBetMarkdown } from "../../src/bep/template.js";

describe("renderNewBetMarkdown", () => {
  test("includes required frontmatter fields", () => {
    const markdown = renderNewBetMarkdown({
      id: "landing-page",
      createdAt: "2026-02-18T00:00:00.000Z",
      leadingIndicator: {
        type: "manual",
        operator: "gte",
        target: 20,
      },
      primaryAssumption: "People need a simpler signup flow.",
      validationPlan: "Track signup completion rate over two weeks.",
      notes: "Coordinate with marketing launch.",
    });

    const parsed = matter(markdown);
    expect(parsed.data).toEqual({
      id: "landing-page",
      status: "pending",
      created_at: "2026-02-18T00:00:00.000Z",
      leading_indicator: {
        type: "manual",
        operator: "gte",
        target: 20,
      },
    });
    expect(parsed.data).not.toHaveProperty("default_action");
    expect(parsed.content).toContain("# Budgeted Engineering Proposal");
    expect(parsed.content).toContain("## 1. Primary Assumption");
    expect(parsed.content).toContain("## 2. Validation Plan");
    expect(parsed.content).toContain("## 3. Notes");
    expect(parsed.content).not.toContain("## 2. Rationale");
    expect(parsed.content).toContain("People need a simpler signup flow.");
    expect(parsed.content).toContain("Track signup completion rate over two weeks.");
    expect(parsed.content).toContain("Coordinate with marketing launch.");
  });

  test("omits optional fields when not provided", () => {
    const markdown = renderNewBetMarkdown({
      id: "onboarding-v2",
      createdAt: "2026-02-18T00:00:00.000Z",
      leadingIndicator: {
        type: "manual",
        operator: "gt",
        target: 10,
      },
      primaryAssumption: "New onboarding copy reduces confusion.",
      validationPlan: "Compare activation within first 24 hours.",
      notes: "",
    });

    const parsed = matter(markdown);
    expect(parsed.data).not.toHaveProperty("max_hours");
    expect(parsed.data).not.toHaveProperty("max_calendar_days");
    expect(parsed.data).not.toHaveProperty("default_action");
    expect(parsed.data).toHaveProperty("leading_indicator");
  });

  test("includes optional cap fields when provided", () => {
    const markdown = renderNewBetMarkdown({
      id: "onboarding-v2",
      createdAt: "2026-02-18T00:00:00.000Z",
      leadingIndicator: {
        type: "manual",
        operator: "eq",
        target: 50,
      },
      maxHours: 12,
      maxCalendarDays: 10,
      primaryAssumption: "Refined CTAs improve conversion.",
      validationPlan: "Run A/B test and review conversion deltas.",
      notes: "Requires design review.",
    });

    const parsed = matter(markdown);
    expect(parsed.data).toMatchObject({
      max_hours: 12,
      max_calendar_days: 10,
    });
  });
});
