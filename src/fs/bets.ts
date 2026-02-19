import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { BETS_DIR } from "./init";

type ParsedBetFile = matter.GrayMatterFile<string>;

export type ReadBetFileResult = {
  relativePath: string;
  absolutePath: string;
  markdown: string;
  parsed: ParsedBetFile;
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

  let parsed: ParsedBetFile;
  try {
    parsed = matter(markdown);
  } catch (error) {
    throw new Error(`Failed to parse BEP file at ${relativePath}: ${(error as Error).message}`);
  }

  return {
    relativePath,
    absolutePath,
    markdown,
    parsed,
  };
}

export async function writeBetFile(rootDir: string, idOrFileName: string, parsed: ParsedBetFile): Promise<void> {
  const absolutePath = getBetAbsolutePath(rootDir, idOrFileName);
  await writeFile(absolutePath, matter.stringify(parsed.content, parsed.data), "utf8");
}
