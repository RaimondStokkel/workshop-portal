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
  const defaultDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const reasoningDeployment = process.env.AZURE_OPENAI_REASONING_DEPLOYMENT;
  const reasoningApiVersion =
    process.env.AZURE_OPENAI_REASONING_API_VERSION ?? apiVersion;
  const reasoningEndpoint =
    process.env.AZURE_OPENAI_REASONING_ENDPOINT ?? endpoint;
  const reasoningApiKey = process.env.AZURE_OPENAI_REASONING_API_KEY;

  if (!endpoint || !defaultDeployment || !apiVersion) {
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
  const wantsReasoning = Boolean(reasoning?.enabled);

  if (wantsReasoning && !reasoningDeployment) {
    return NextResponse.json(
      {
        error:
          "Reasoning toggle is enabled but AZURE_OPENAI_REASONING_DEPLOYMENT is not set.",
      },
      { status: 400 },
    );
  }

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];

  const payload: Record<string, unknown> = {
    messages,
    temperature,
    top_p: topP,
  };

  const includeReasoningParam =
    process.env.AZURE_OPENAI_REASONING_INCLUDE_REASONING_PARAM?.toLowerCase() ===
    "true";

  if (wantsReasoning) {
    if (includeReasoningParam) {
      payload.reasoning = {
        effort: reasoning.effort ?? "medium",
      };
      if (reasoning.maxOutputTokens) {
        payload.max_output_tokens = reasoning.maxOutputTokens;
      }
    } else if (reasoning?.maxOutputTokens) {
      payload.max_output_tokens = reasoning.maxOutputTokens;
    }
  }

  const targetDeployment = wantsReasoning ? reasoningDeployment! : defaultDeployment;
  const targetApiVersion = wantsReasoning ? reasoningApiVersion : apiVersion;
  const targetEndpoint = wantsReasoning ? reasoningEndpoint : endpoint;

  if (!targetEndpoint) {
    return NextResponse.json(
      {
        error:
          "Reasoning toggle is enabled but neither AZURE_OPENAI_REASONING_ENDPOINT nor AZURE_OPENAI_ENDPOINT are configured.",
      },
      { status: 400 },
    );
  }

  try {
    const headers = await buildAzureOpenAIHeaders({
      apiKeyOverride: wantsReasoning ? reasoningApiKey : undefined,
    });
    const response = await fetch(
      `${targetEndpoint}/openai/deployments/${targetDeployment}/chat/completions?api-version=${targetApiVersion}`,
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
