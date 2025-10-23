import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAzureOpenAIHeaders } from "@/lib/azureClient";
import { retrieveKnowledge } from "@/lib/knowledgeBase";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AzureChatResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: Record<string, unknown>;
};

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
  knowledgeBase: z
    .object({
      enabled: z.boolean(),
      topK: z.coerce.number().int().min(1).max(5).default(3),
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

  const {
    systemPrompt,
    prompt,
    temperature,
    topP,
    reasoning,
    knowledgeBase,
  } = parsed;
  const wantsReasoning = Boolean(reasoning?.enabled);
  const wantsKnowledge = Boolean(knowledgeBase?.enabled);

  if (wantsReasoning && !reasoningDeployment) {
    return NextResponse.json(
      {
        error:
          "Reasoning toggle is enabled but AZURE_OPENAI_REASONING_DEPLOYMENT is not set.",
      },
      { status: 400 },
    );
  }

  let knowledgeSnippets: Awaited<ReturnType<typeof retrieveKnowledge>> = [];
  if (wantsKnowledge) {
    try {
      knowledgeSnippets = await retrieveKnowledge(
        prompt,
        knowledgeBase?.topK ?? 3,
      );
    } catch (error) {
      console.error("Knowledge retrieval failed", error);
      return NextResponse.json(
        {
          error:
            "Knowledge base lookup failed. Confirm data/knowledge-base.json exists and contains valid JSON.",
        },
        { status: 500 },
      );
    }
  }

  const messages: ChatMessage[] = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt } as const] : []),
    { role: "user", content: prompt },
  ];

  if (wantsKnowledge && knowledgeSnippets.length > 0) {
    const contextText = knowledgeSnippets
      .map(
        (snippet, index) =>
          `[KB${index + 1}] ${snippet.title}\n${snippet.excerpt}`,
      )
      .join("\n\n");

    const insertIndex = systemPrompt ? 1 : 0;
    messages.splice(insertIndex, 0, {
      role: "system",
      content:
        "Use the following knowledge base snippets as trusted context. Cite them inline using [KB#] when relevant.\n\n" +
        contextText,
    });
  }

  const payload: Record<string, unknown> = {
    messages,
  };

  const includeReasoningParam =
    process.env.AZURE_OPENAI_REASONING_INCLUDE_REASONING_PARAM?.toLowerCase() ===
    "true";

  if (wantsReasoning) {
    const selectedReasoning = reasoning!;
    if (includeReasoningParam) {
      payload.reasoning = {
        effort: selectedReasoning.effort ?? "medium",
      };
    }
    if (selectedReasoning.maxOutputTokens) {
      payload.max_completion_tokens = selectedReasoning.maxOutputTokens;
    }
  } else {
    payload.temperature = temperature;
    payload.top_p = topP;
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

    const data = (await response.json()) as AzureChatResponse;
    const choice = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      message: choice,
      usage: data.usage,
      knowledgeSnippets: wantsKnowledge ? knowledgeSnippets : undefined,
    });
  } catch (error) {
    console.error("Unexpected chat handler failure", error);
    return NextResponse.json(
      {
        error: "Unexpected error calling Azure OpenAI",
      },
      { status: 500 },
    );
  }
}
