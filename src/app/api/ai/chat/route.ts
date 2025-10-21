import { NextRequest, NextResponse } from "next/server";
import { buildAzureOpenAIHeaders } from "@/lib/azureClient";
import { z } from "zod";

const chatSchema = z.object({
  systemPrompt: z.string().optional(),
  prompt: z.string().min(1, "Prompt cannot be empty"),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  topP: z.coerce.number().min(0).max(1).default(0.9),
  reasoning: z
    .object({
      enabled: z.boolean(),
      effort: z.enum(["low", "medium", "high"]).optional(),
      maxOutputTokens: z.coerce.number().int().min(1).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !deployment || !apiVersion) {
    return NextResponse.json(
      {
        error:
          "Azure OpenAI environment variables are missing. Check AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_CHAT_DEPLOYMENT, and AZURE_OPENAI_API_VERSION.",
      },
      { status: 500 },
    );
  }

  let parsed;
  try {
    const body = await request.json();
    parsed = chatSchema.parse(body);
  } catch (error) {
    console.error("Invalid chat payload", error);
    return NextResponse.json(
      {
        error: "Invalid request payload",
      },
      { status: 400 },
    );
  }

  const { systemPrompt, prompt, temperature, topP, reasoning } = parsed;

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];

  const payload: Record<string, unknown> = {
    messages,
    temperature,
    top_p: topP,
  };

  if (reasoning?.enabled) {
    payload.reasoning = {
      effort: reasoning.effort ?? "medium",
    };
    if (reasoning.maxOutputTokens) {
      payload.max_output_tokens = reasoning.maxOutputTokens;
    }
  }

  try {
    const headers = await buildAzureOpenAIHeaders();
    const response = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure OpenAI chat error", response.status, errorText);
      return NextResponse.json(
        {
          error: "Azure OpenAI chat request failed",
          status: response.status,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      message: choice,
      usage: data.usage,
      raw: data,
    });
  } catch (error) {
    console.error("Failed to call Azure OpenAI chat", error);
    return NextResponse.json(
      {
        error: "Unable to reach Azure OpenAI chat endpoint",
      },
      { status: 500 },
    );
  }
}
