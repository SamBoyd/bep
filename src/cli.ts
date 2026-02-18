import { Command } from "commander";
import { runInit } from "./commands/init";

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

  await program.parseAsync(argv);
}

void main(process.argv);
