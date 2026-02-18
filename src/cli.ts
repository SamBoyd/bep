import { Command } from "commander";
import { runInit } from "./commands/init";
import { runNew } from "./commands/new";

export async function main(argv: string[]): Promise<void> {
  const program = new Command();

  program.name("bep").description("Budgeted Engineering Proposals CLI");

  program
    .command("init")
    .description("Initialize BEP directories in the current repository")
    .action(async () => {
      const exitCode = await runInit(process.cwd());
      process.exitCode = exitCode;
    });

  program
    .command("new <id>")
    .description("Create a new BEP markdown file")
    .action(async (id: string) => {
      const exitCode = await runNew(process.cwd(), id);
      process.exitCode = exitCode;
    });

  await program.parseAsync(argv);
}

void main(process.argv);
