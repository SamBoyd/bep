jest.mock("../src/commands/new", () => ({
  runNew: jest.fn(),
}));

import { main } from "../src/cli";
import { runNew } from "../src/commands/new";

const mockedRunNew = runNew as jest.MockedFunction<typeof runNew>;

describe("cli", () => {
  beforeEach(() => {
    mockedRunNew.mockReset();
    process.exitCode = undefined;
  });

  test("passes full unquoted new-name phrase including command token", async () => {
    mockedRunNew.mockResolvedValue(0);

    await main(["node", "/dist/cli.js", "new", "landing", "page"]);

    expect(mockedRunNew).toHaveBeenCalledWith("new landing page");
    expect(process.exitCode).toBe(0);
  });
});
