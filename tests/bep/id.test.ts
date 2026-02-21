import { isValidBetId } from "../../src/bep/id";

describe("isValidBetId", () => {
  test("accepts lowercase ids with hyphen or underscore separators", () => {
    expect(isValidBetId("landing-page")).toBe(true);
    expect(isValidBetId("v2-flow")).toBe(true);
    expect(isValidBetId("abc123")).toBe(true);
    expect(isValidBetId("landing_page")).toBe(true);
    expect(isValidBetId("v2_flow")).toBe(true);
  });

  test("rejects invalid ids", () => {
    expect(isValidBetId("Landing-Page")).toBe(false);
    expect(isValidBetId("Landing_Page")).toBe(false);
    expect(isValidBetId("-landing-page")).toBe(false);
    expect(isValidBetId("landing-page-")).toBe(false);
    expect(isValidBetId("landing--page")).toBe(false);
    expect(isValidBetId("landing__page")).toBe(false);
    expect(isValidBetId("landing-_page")).toBe(false);
    expect(isValidBetId("landing page")).toBe(false);
  });
});
