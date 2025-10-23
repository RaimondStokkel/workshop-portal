# Advanced Prompting Techniques

Welcome to the deep end of prompt engineering. In this module you will experiment with structured reasoning scaffolds, multi-turn prompting patterns, and quality checks that help models stay on track.

## Chain-of-Thought (CoT)

Chain-of-Thought prompts ask the model to explain each step before reaching a final conclusion.

- **Pattern**: "Let's work this out step by step" or numbered instructions that force incremental reasoning.
- **Why it works**: Exposes intermediate logic, making it easier to spot hallucinations or math slips.
- **Try it**: Toggle CoT on a tricky logic puzzle and compare temperatures.

### CoT Best Practices

1. Encourage reflection: "Before you answer, list the facts you know."  
2. Bound the scope: "Show at most five steps so the summary stays compact."  
3. Score yourself: "Rate your confidence from 1-5 and justify the score."

## Self-Consistency

Instead of a single answer, ask the model to explore multiple drafts and vote on the best one.

- Use a loop or tool to send the same prompt with different temperature seeds.  
- Aggregate answers manually or via another model pass that chooses the consensus.

### Workshop Drill

1. Turn on reasoning mode with higher max tokens.  
2. Request: "List two possible solutions, then pick the stronger one."  
3. Inspect usage stats: longer traces mean deeper reasoning.

## Role Stacking

Mix system, developer, and user instructions to fine-tune behavior.

- System prompt: "You are a meticulous reviewer."  
- Developer (in chat UI, treat as hidden rules): "Never fabricate APIs."  
- User prompt: "Audit this code."  
- Follow-up prompt: "Summarize your verdict in a table."  

Notice how persistent roles retain tone across turns.

## Guardrails in the Prompt

Strong prompts anticipate failure modes.

- Demand citations: "Cite your sources as [KB#] or state 'No source'."  
- Require constraints: "If information is missing, say 'Need more context'."  
- Provide evaluator checklists: "Score accuracy, completeness, and risks separately."

## Wrap-Up

Advanced prompting is iterative. Blend CoT, self-consistency, and layered instructions to guide the model toward verifiable results. In the next module we ground generations with retrieved context.
