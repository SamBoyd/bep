import { initRepo } from "../fs/init";

export async function runInit(): Promise<number> {
  const cwd = process.cwd();
  const result = await initRepo(cwd);

  if (result.alreadyInitialized) {
    console.log("BEP is already initialized.");
    return 0;
  }

  console.log(`Initialized BEP in this repository (${result.createdPaths.length} items created).`);
  return 0;
}
