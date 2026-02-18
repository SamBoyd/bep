import { Command } from "commander";
import { runInit } from "./commands/init";
import { runCheck } from "./commands/check";
import { runNew } from "./commands/new";
import { runStart } from "./commands/start";
import { runStop } from "./commands/stop";

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

  program
    .command("start <id>")
    .description("Start work on an existing BEP")
    .action(async (id: string) => {
      const exitCode = await runStart(process.cwd(), id);
      process.exitCode = exitCode;
    });

  program
    .command("stop <id>")
    .description("Stop work on an active BEP and log session exposure")
    .action(async (id: string) => {
      const exitCode = await runStop(process.cwd(), id);
      process.exitCode = exitCode;
    });

  program
    .command("check <id>")
    .description("Capture manual validation evidence for a BEP")
    .action(async (id: string) => {
      const exitCode = await runCheck(process.cwd(), id);
      process.exitCode = exitCode;
    });

  await program.parseAsync(argv);
}

void main(process.argv);
