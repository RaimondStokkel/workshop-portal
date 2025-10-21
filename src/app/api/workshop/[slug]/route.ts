import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

function getWorkshopDir() {
  return path.join(process.cwd(), "content", "workshop");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const dir = getWorkshopDir();
    const filePath = path.join(dir, `${params.slug}.md`);
    const fileContents = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content: fileContents });
  } catch (error) {
    console.error(`Failed to load module ${params.slug}`, error);
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
}
