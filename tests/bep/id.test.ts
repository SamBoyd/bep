import { isValidBetId } from "../../src/bep/id";

describe("isValidBetId", () => {
  test("accepts lowercase slug ids", () => {
    expect(isValidBetId("landing-page")).toBe(true);
    expect(isValidBetId("v2-flow")).toBe(true);
    expect(isValidBetId("abc123")).toBe(true);
  });

  test("rejects invalid ids", () => {
    expect(isValidBetId("Landing-Page")).toBe(false);
    expect(isValidBetId("landing_page")).toBe(false);
    expect(isValidBetId("-landing-page")).toBe(false);
    expect(isValidBetId("landing-page-")).toBe(false);
    expect(isValidBetId("landing--page")).toBe(false);
    expect(isValidBetId("landing page")).toBe(false);
  });
});
