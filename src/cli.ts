import { Command } from "commander";
import { runInit } from "./commands/init";
import { runCheck } from "./commands/check";
import { runNew } from "./commands/new";
import { runStart } from "./commands/start";
import { runStop } from "./commands/stop";
import { runStatus } from "./commands/status";
import { runHook } from "./commands/hook";

export async function main(argv: string[]): Promise<void> {
  const program = new Command();

  program.name("bep").description("Budgeted Engineering Proposals CLI");

  program
    .command("init")
    .description("Initialize BEP directories in the current repository")
    .option("--install-hooks", "Install agent tracking hooks")
    .option("--no-install-hooks", "Skip agent tracking hook setup")
    .option("--agent <agent>", "Agent target for hook setup (currently: claude-code)")
    .action(async (options: { installHooks?: boolean; agent?: string }) => {
      const exitCode = await runInit({
        installHooks: options.installHooks,
        agent: options.agent,
      });
      process.exitCode = exitCode;
    });

  program
    .command("new [id...]")
    .description("Create a new BEP markdown file")
    .action(async (idParts?: string[]) => {
      const id = idParts && idParts.length > 0 ? ["new", ...idParts].join(" ") : undefined;
      const exitCode = await runNew(id);
      process.exitCode = exitCode;
    });

  program
    .command("start <id>")
    .description("Start work on an existing BEP")
    .action(async (id: string) => {
      const exitCode = await runStart(id);
      process.exitCode = exitCode;
    });

  program
    .command("stop <id>")
    .description("Stop work on an active BEP and log session exposure")
    .action(async (id: string) => {
      const exitCode = await runStop(id);
      process.exitCode = exitCode;
    });

  program
    .command("status")
    .description("Show status for current bets")
    .action(async () => {
      const exitCode = await runStatus();
      process.exitCode = exitCode;
    });

  program
    .command("check <id>")
    .description("Capture manual validation evidence for a BEP")
    .action(async (id: string) => {
      const exitCode = await runCheck(id);
      process.exitCode = exitCode;
    });

  program
    .command("hook <agent> <event>")
    .description("Internal command used by agent hook integrations")
    .action(async (agent: string, event: string) => {
      const exitCode = await runHook(agent, event);
      process.exitCode = exitCode;
    });

  await program.parseAsync(argv);
}

if (require.main === module) {
  void main(process.argv);
}
