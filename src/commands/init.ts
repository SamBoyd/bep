import { initRepo } from "../fs/init";
import { installAgentHooks } from "../hooks/install";
import { runInitHookPrompt } from "../ui/initHooks";

export type RunInitOptions = {
  installHooks?: boolean;
  agent?: string;
};

function isInteractiveTty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export async function runInit(options: RunInitOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const result = await initRepo(cwd);

  if (result.alreadyInitialized) {
    console.log("BEP is already initialized.");
  } else {
    console.log(`Initialized BEP in this repository (${result.createdPaths.length} items created).`);
  }

  let shouldInstallHooks = options.installHooks;
  if (shouldInstallHooks === undefined && options.agent !== undefined) {
    shouldInstallHooks = true;
  }

  if (shouldInstallHooks === false && options.agent) {
    console.error("Cannot use --agent with --no-install-hooks.");
    return 1;
  }

  if (shouldInstallHooks === false) {
    return 0;
  }

  let selectedAgent = options.agent;
  if (shouldInstallHooks === undefined && isInteractiveTty()) {
    const promptResult = await runInitHookPrompt();
    if (promptResult.kind === "cancel") {
      console.error("Cancelled hook setup.");
      return 1;
    }

    if (promptResult.kind === "skip") {
      return 0;
    }

    selectedAgent = promptResult.agent;
  }

  if (shouldInstallHooks === undefined && !selectedAgent) {
    return 0;
  }

  const installResult = await installAgentHooks(cwd, selectedAgent ?? "claude-code");
  if (!installResult.ok) {
    console.error(installResult.error);
    return 1;
  }

  if (installResult.alreadyInstalled) {
    console.log(`Claude Code tracking hooks are already installed (${installResult.settingsPathRelative}).`);
    return 0;
  }

  console.log(`Installed Claude Code tracking hooks in ${installResult.settingsPathRelative}.`);
  return 0;
}
