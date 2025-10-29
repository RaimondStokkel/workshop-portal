# Agents and Tooling

This module introduces Model Context Protocol (MCP) agents and shows how tools extend your prompt workflows with live capabilities.

## What is an Agent?

Agents orchestrate multiple model calls, tools, and memory so you can solve complex tasks with a single request. Instead of manually retrieving data or running code, you describe the goal and let the agent choose which tools to call.

- **Planner**: Decides which steps and tools are required.
- **Executor**: Runs the tool calls, captures results, and feeds them back to the model.
- **Responder**: Composes the final answer using tool outputs and previous context.

## MCP in Practice

The Model Context Protocol standardizes how models communicate with tools. Each MCP server exposes a catalog of tools that an agent can discover and invoke. A tool call includes:

1. Tool name (for discovery and routing).
2. JSON arguments that describe the request.
3. Optional streaming responses or structured return values.

> **Tip**: MCP allows teams to reuse tool connections across agents and languages. Once you define a server for a data source, every compatible client can call it.

## Workshop Agent Playground

Open the **Agent Playground** card in this app to try it out:

1. Type an instruction such as "Summarize the modules that cover grounding."  
2. The agent decides whether to call the `knowledge_lookup` or `list_workshop_modules` tools.  
3. Tool results show up in the conversation so you can trace the reasoning.  
4. Adjust temperature/top-p if you want more creative planning.

### Optional: Dutch NS Train Server

Use the new **Enable NS MCP server** button in the Agent Playground to surface a ready-made configuration snippet:

1. Copy the JSON block into your MCP client configuration.  
2. Set the `NS_API_KEY` environment variable (request one from the Nederlandse Spoorwegen developer portal).  
3. Run `npx -y ns-mcp-server` locally to expose tool calls such as `ns-server.get_departures` or `ns-server.get_disturbances`.  
4. Restart the playground session; the agent now has live rail data it can cite alongside workshop content.

## Designing Helpful Tools

- Keep JSON schemas explicit so the model knows required arguments.  
- Return concise results with identifiers the model can cite.  
- Add descriptions that explain when to call the tool and what it returns.  
- Prefer deterministic outputs to make agent reasoning repeatable.

## Next Steps

To connect to your own MCP server:

1. Implement the server using the MCP SDK of your choice.  
2. Expose tools such as document search, status dashboards, or runbooks.  
3. Swap the local tool handlers in `src/app/api/ai/agent/route.ts` with API calls to your server.  
4. Deploy and validate that the agent cites tool outputs in its final answer.

Agents turn your prompt playground into an orchestration surface. Pair them with reasoning mode, knowledge grounding, and custom tools for end-to-end automation.
