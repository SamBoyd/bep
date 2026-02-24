await jest.unstable_mockModule("../src/commands/new.js", () => ({
  runNew: jest.fn(),
}));

const { main } = await import("../src/cli.js");
const { runNew } = await import("../src/commands/new.js");

const mockedRunNew = runNew as jest.MockedFunction<typeof runNew>;

describe("cli", () => {
  beforeEach(() => {
    mockedRunNew.mockReset();
    process.exitCode = undefined;
  });

  test("passes full unquoted new-name phrase including command token", async () => {
    mockedRunNew.mockResolvedValue(0);

    await main(["node", "/dist/cli.js", "new", "landing", "page"]);

    expect(mockedRunNew).toHaveBeenCalledWith("landing page");
    expect(process.exitCode).toBe(0);
  });
});
