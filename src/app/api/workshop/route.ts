import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

function getWorkshopDir() {
  return path.join(process.cwd(), "content", "workshop");
}

type WorkshopMetadata = {
  slug: string;
  title: string;
  summary: string;
};

async function readFirstHeading(filePath: string) {
  const fileContents = await fs.readFile(filePath, "utf-8");
  const lines = fileContents.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith("#"));
  const summaryLine = lines.find((line) =>
    line.trim().length > 0 && !line.trim().startsWith("#"),
  );

  return {
    title: titleLine ? titleLine.replace(/^#+\s*/, "").trim() : "Workshop Module",
    summary: summaryLine?.trim() ?? "",
  };
}

export async function GET() {
  try {
    const dir = getWorkshopDir();
    const entries = await fs.readdir(dir);
    const modules: WorkshopMetadata[] = await Promise.all(
      entries
        .filter((file) => file.endsWith(".md"))
        .sort()
        .map(async (file) => {
          const slug = file.replace(/\.md$/, "");
          const { title, summary } = await readFirstHeading(path.join(dir, file));
          return { slug, title, summary } satisfies WorkshopMetadata;
        }),
    );

    return NextResponse.json({ modules });
  } catch (error) {
    console.error("Failed to list workshop modules", error);
    return NextResponse.json(
      {
        error: "Unable to load workshop modules",
      },
      { status: 500 },
    );
  }
}
