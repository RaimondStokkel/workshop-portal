import { promises as fs } from "fs";
import path from "path";

export type KnowledgeBaseEntry = {
  id: string;
  title: string;
  content: string;
};

export type RetrievedSnippet = KnowledgeBaseEntry & {
  score: number;
  excerpt: string;
};

let cache: KnowledgeBaseEntry[] | null = null;

async function loadKnowledgeBase(): Promise<KnowledgeBaseEntry[]> {
  if (cache) {
    return cache;
  }

  const filePath = path.join(process.cwd(), "data", "knowledge-base.json");
  try {
    const fileContents = await fs.readFile(filePath, "utf-8");
    cache = JSON.parse(fileContents) as KnowledgeBaseEntry[];
    return cache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "Knowledge base file is missing. Populate data/knowledge-base.json to enable retrieval.",
      );
    }
    throw error;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildExcerpt(content: string, terms: Set<string>): string {
  const sentences = content.split(/(?<=[.!?])\s+/);
  const match = sentences.find((sentence) => {
    const normalized = tokenize(sentence);
    return normalized.some((token) => terms.has(token));
  });
  return (match ?? sentences[0] ?? "").trim();
}

export async function retrieveKnowledge(
  query: string,
  topK: number,
): Promise<RetrievedSnippet[]> {
  const entries = await loadKnowledgeBase();
  const queryTokens = new Set(tokenize(query));

  if (!queryTokens.size) {
    return [];
  }

  const scored = entries
    .map((entry) => {
      const entryTokens = new Set(tokenize(`${entry.title} ${entry.content}`));
      let score = 0;
      queryTokens.forEach((token) => {
        if (entryTokens.has(token)) {
          score += 1;
        }
      });
      return {
        ...entry,
        score,
        excerpt: buildExcerpt(entry.content, queryTokens),
      } satisfies RetrievedSnippet;
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(topK, entries.length)));

  return scored;
}
