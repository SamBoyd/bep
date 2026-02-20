import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { BetFile, BetFrontmatter } from "../bep/file";
import { BETS_DIR } from "./init";

export type ReadBetFileResult = {
  relativePath: string;
  absolutePath: string;
  markdown: string;
  bet: BetFile;
};

export function getBetRelativePath(idOrFileName: string): string {
  const fileName = idOrFileName.endsWith(".md") ? idOrFileName : `${idOrFileName}.md`;
  return path.join(BETS_DIR, fileName);
}

export function getBetAbsolutePath(rootDir: string, idOrFileName: string): string {
  return path.join(rootDir, getBetRelativePath(idOrFileName));
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readBetFile(rootDir: string, idOrFileName: string): Promise<ReadBetFileResult> {
  const relativePath = getBetRelativePath(idOrFileName);
  const absolutePath = getBetAbsolutePath(rootDir, idOrFileName);

  let markdown: string;
  try {
    markdown = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`Failed to parse BEP file at ${relativePath}: ${(error as Error).message}`);
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(markdown);
  } catch (error) {
    throw new Error(`Failed to parse BEP file at ${relativePath}: ${(error as Error).message}`);
  }

  return {
    relativePath,
    absolutePath,
    markdown,
    bet: {
      content: parsed.content,
      data: parsed.data as BetFrontmatter,
    },
  };
}

export async function listBetMarkdownFiles(rootDir: string): Promise<string[]> {
  const betsDir = path.join(rootDir, BETS_DIR);
  const entries = await readdir(betsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function writeBetFile(rootDir: string, idOrFileName: string, bet: BetFile): Promise<void> {
  const absolutePath = getBetAbsolutePath(rootDir, idOrFileName);
  await writeFile(absolutePath, matter.stringify(bet.content, bet.data), "utf8");
}
