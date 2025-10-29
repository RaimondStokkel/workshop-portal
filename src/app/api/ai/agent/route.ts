import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import { promises as fs } from "fs";
import { buildAzureOpenAIHeaders } from "@/lib/azureClient";
import { retrieveKnowledge } from "@/lib/knowledgeBase";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentToolExecution = {
  name: string;
  arguments: Record<string, unknown>;
  output: unknown;
};

type AzureToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type AzureChatChoice = {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: AzureToolCall[];
  };
};

type AzureChatResponse = {
  choices?: AzureChatChoice[];
  usage?: Record<string, unknown>;
};

const agentSchema = z.object({
  systemPrompt: z.string().optional(),
  prompt: z.string().min(1, "Prompt cannot be empty"),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  topP: z.coerce.number().min(0).max(1).default(0.9),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
});

async function listWorkshopModules() {
  const dir = path.join(process.cwd(), "content", "workshop");
  const entries = await fs.readdir(dir);
  const modules = await Promise.all(
    entries
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map(async (file) => {
        const slug = file.replace(/\.md$/, "");
        const filePath = path.join(dir, file);
        const contents = await fs.readFile(filePath, "utf-8");
        const lines = contents.split(/\r?\n/);
        const titleLine = lines.find((line) => line.startsWith("#"));
        const summaryLine = lines.find(
          (line) => line.trim().length > 0 && !line.trim().startsWith("#"),
        );
        return {
          slug,
          title: titleLine ? titleLine.replace(/^#+\s*/, "").trim() : slug,
          summary: summaryLine?.trim() ?? "",
        };
      }),
  );

  return modules;
}

async function executeToolCall(toolCall: AzureToolCall): Promise<AgentToolExecution> {
  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = toolCall.function.arguments
      ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
      : {};
  } catch (error) {
    return {
      name: toolCall.function.name,
      arguments: {},
      output: {
        error: "Failed to parse tool arguments",
        details: (error as Error).message,
      },
    };
  }

  switch (toolCall.function.name) {
    case "knowledge_lookup": {
      const query = typeof parsedArgs.query === "string" ? parsedArgs.query : "";
      const topK = typeof parsedArgs.topK === "number" ? parsedArgs.topK : 3;
      if (!query.trim()) {
        return {
          name: toolCall.function.name,
          arguments: parsedArgs,
          output: {
            error: "Missing required query argument.",
          },
        };
      }
      const snippets = await retrieveKnowledge(query, Math.min(Math.max(topK, 1), 5));
      return {
        name: toolCall.function.name,
        arguments: parsedArgs,
        output: { snippets },
      };
    }
    case "list_workshop_modules": {
      const modules = await listWorkshopModules();
      return {
        name: toolCall.function.name,
        arguments: parsedArgs,
        output: { modules },
      };
    }
    default:
      return {
        name: toolCall.function.name,
        arguments: parsedArgs,
        output: {
          error: `Tool ${toolCall.function.name} is not implemented on this server.`,
        },
      };
  }
}

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
    parsed = agentSchema.parse(body);
  } catch (error) {
    console.error("Invalid agent payload", error);
    return NextResponse.json(
      {
        error: "Invalid request payload",
      },
      { status: 400 },
    );
  }

  const { systemPrompt, prompt, temperature, topP, history } = parsed;

  const messages: Array<Record<string, unknown>> = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...history.map<ConversationMessage>((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user", content: prompt },
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "knowledge_lookup",
        description:
          "Retrieve the most relevant snippets from the workshop knowledge base to ground answers.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query or question to look up.",
            },
            topK: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              description: "How many snippets to return (default 3).",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_workshop_modules",
        description: "List workshop modules with their titles and summaries.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
  ];

  const toolExecutions: AgentToolExecution[] = [];
  const maxIterations = 4;

  try {
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const headers = await buildAzureOpenAIHeaders();
      const response = await fetch(
        `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            messages,
            tools,
            temperature,
            top_p: topP,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Azure OpenAI agent error", response.status, errorText);
        return NextResponse.json(
          {
            error: "Azure OpenAI agent request failed",
            status: response.status,
            details: errorText,
          },
          { status: response.status },
        );
      }

      const data = (await response.json()) as AzureChatResponse;
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        return NextResponse.json(
          {
            error: "Azure OpenAI agent response did not include a message",
          },
          { status: 500 },
        );
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push({
          role: message.role ?? "assistant",
          content: message.content ?? "",
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          const execution = await executeToolCall(toolCall);
          toolExecutions.push(execution);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(execution.output ?? {}),
          });
        }

        continue;
      }

      const assistantContent = message.content ?? "";
      messages.push({ role: "assistant", content: assistantContent });

      return NextResponse.json({
        message: assistantContent,
        usage: data.usage,
        toolExecutions,
      });
    }

    return NextResponse.json(
      {
        error: "Agent exceeded maximum number of tool iterations",
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("Unexpected agent handler failure", error);
    return NextResponse.json(
      {
        error: "Unexpected error calling Azure OpenAI agent",
      },
      { status: 500 },
    );
  }
}
