# Retrieval-Augmented Generation (RAG)

Now we bridge models with your own knowledge sources. Retrieval-Augmented Generation fetches supporting evidence and injects it into the prompt so the model can answer with citations.

## Concept Quickstart

1. **Retrieve**: Identify relevant passages using keyword or vector search.  
2. **Augment**: Embed the retrieved text into the conversation (usually as system or developer instructions).  
3. **Generate**: Ask the model to respond while citing the provided snippets.  
4. **Evaluate**: Check that every claim maps to a cited passage; rerank or re-retrieve if needed.

## Hands-On in the Playground

1. Enable the **Knowledge Base** toggle in the Text Playground.  
2. Ask a question related to Azure prompt engineering (for example, "How do I stop hallucinations when using chain-of-thought?").  
3. Inspect the **Knowledge Base Context** panel. You should see snippets gathered from `data/knowledge-base.json` and citations like `[KB1]` in the response.  
4. Experiment with different **Top K** values to widen or narrow the evidence window.

> **Tip**: The supplied dataset is intentionally small and keyword-based so you can inspect the full flow. Swap in your own documents by editing `data/knowledge-base.json` and redeploying.

## Connecting to Azure AI Search

Follow these steps to plug in a real search index:

1. Create an **Azure AI Search** service and index with fields for `id`, `title`, `content`, and optional `tags`.  
2. Populate the index using the Azure portal, Azure Search SDKs, or the REST API.  
3. Replace the local retriever with a call to the Search REST endpoint in `src/lib/knowledgeBase.ts` (or build a new helper that queries `https://<search>.search.windows.net/indexes/<name>/docs?api-version=2024-07-01-preview`).  
4. Pass the top results into the chat payload just like the local snippets, including concise excerpts and citation identifiers.  
5. Store your Search service key in an environment variable such as `AZURE_SEARCH_API_KEY` and load it server-side only.

## Prompting Patterns for Grounded Answers

- Ask the model to refuse when the context does not cover the question.  
- Nudge the tone: "Answer in two bullet points and include a short risk note."  
- Encourage explicit citations: "Use [KB#] after each fact so readers can trace the source."  
- Summarize context first: "List the top snippets with one-sentence takeaways before drafting the answer."

## Quality Checklist

- ✅ Every claim references a retrieved snippet.  
- ✅ The answer acknowledges when information is missing.  
- ✅ Temperature remains low (<= 0.4) for grounded answers; raise only when brainstorming.  
- ✅ Logs show the retrieved snippets so you can audit the run later.

RAG transforms your app from a generic assistant into an expert that knows your data. Combine grounding with the advanced prompting techniques from the previous module for trustworthy, traceable responses.
