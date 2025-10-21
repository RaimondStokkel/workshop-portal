import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAzureOpenAIHeaders } from "@/lib/azureClient";

const imageSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  size: z
    .enum(["1024x1024", "1792x1024", "1024x1792"])
    .default("1024x1024"),
  style: z.enum(["vivid", "natural"]).default("vivid"),
  quality: z.enum(["standard", "hd"]).default("standard"),
  n: z.coerce.number().int().min(1).max(4).default(1),
  responseFormat: z.enum(["b64_json", "url"]).default("b64_json"),
});

export async function POST(request: NextRequest) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !deployment || !apiVersion) {
    return NextResponse.json(
      {
        error:
          "Azure OpenAI environment variables are missing. Check AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_IMAGE_DEPLOYMENT, and AZURE_OPENAI_API_VERSION.",
      },
      { status: 500 },
    );
  }

  let parsed;
  try {
    const body = await request.json();
    parsed = imageSchema.parse(body);
  } catch (error) {
    console.error("Invalid image payload", error);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { prompt, size, style, quality, n, responseFormat } = parsed;

  try {
    const headers = await buildAzureOpenAIHeaders();
    const response = await fetch(
      `${endpoint}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          prompt,
          size,
          n,
          style,
          quality,
          response_format: responseFormat,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure OpenAI image error", response.status, errorText);
      return NextResponse.json(
        {
          error: "Azure OpenAI image request failed",
          status: response.status,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const firstImage = data.data?.[0];
    const imageBase64 = firstImage?.b64_json ?? null;
    const imageUrl = firstImage?.url ?? null;

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "Azure OpenAI response did not include image data" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      imageBase64,
      imageUrl,
      raw: data,
    });
  } catch (error) {
    console.error("Failed to call Azure OpenAI image endpoint", error);
    return NextResponse.json(
      {
        error: "Unable to reach Azure OpenAI image endpoint",
      },
      { status: 500 },
    );
  }
}
