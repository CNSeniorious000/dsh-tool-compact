import type { CompactionAgentContext, CompactionEngine } from '@deepseek-ai/dsh-compaction'

// Compile the exact call and result projection against the pinned host's published declarations, rather than trusting the runtime test's fixture.
export async function compactWithHost(engine: CompactionEngine, agent: CompactionAgentContext, signal: AbortSignal): Promise<{ replacedItems: number; freedTokens: number }> {
  const result = await engine.compactIfNeeded(agent, 'context-overflow', signal)
  return result === null ? { replacedItems: 0, freedTokens: 0 } : { replacedItems: result.shadowedSeqs.length, freedTokens: result.shadowedTokenCount }
}
