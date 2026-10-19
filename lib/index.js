/**
 * `dsh-tool-compact` — the `/compact` command, exposed as a tool the MODEL calls.
 *
 * dsh already compacts on its own: `dsh-compaction-basic` watches `agent/pre-step` for token pressure and `agent/request-error` for a provider-confirmed overflow. Both are reactive — they fire when the window is nearly gone, at a boundary chosen by an arithmetic threshold rather than by where the work actually has a seam. The model is the only party that knows it just finished reading forty files it will never look at again. `dsh-compaction`'s own README lists the gap: "Human command, not a model tool".
 *
 * So this plugin adds no compaction of its own. It calls the same seam `/compact` calls, from inside a tool body, which is the one thing the human command cannot do: `compactNow()` requires an IDLE agent (`runMaintenance` throws synchronously otherwise), and a tool always runs mid-turn. `compactIfNeeded(agent, 'context-overflow', signal)` is the mid-turn entry — it wants an open turn, not an idle one — and its range selection is `selectCompactableRange(session, measurement, 0)`, the SAME call `compactNow` makes. Same summary, same retention, different door.
 *
 * @module dsh-tool-compact
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-compact'

/**
 * Both required: this row belongs next to `command-compact`, in the same compaction realm. It ships no patch because the engine may live at profile level (headless) or inside an agent preset's isolated compaction group (web). An unsatisfied injection leaves the row inactive; installing the package alone does not expose a tool.
 */
export const inject = ['tools', 'compaction']

/**
 * Register `compact`.
 * @param ctx - context carrying the tool registry and the compaction engine.
 */
export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'compact',
    description:
      'Condense the earlier part of this conversation into a summary, freeing context window for what comes next. Everything before the current step becomes one summary message; the current step and everything after it stay verbatim.\n\nReach for it early rather than late — there is no need to wait until the window is nearly full. The moment is whenever what comes next does not depend on the detail behind you: a seam in a long task, where you have finished and reported one large piece and the next stands on its own, or a turn in the conversation, where the user opens a subject with little to do with the old one. Compacting at those points is ordinary good housekeeping and the expected thing to do — one summarization call buys back everything the old detail was occupying.\n\nOne habit keeps it safe: if something back there is still load-bearing, write it into a message or a file first, then compact. What the summary keeps survives; exact file contents, command output and quoted text from the compacted range do not.',
    parameters: {
      reason: { type: 'string', description: 'What you are wrapping up — the work this history belonged to, and what you took from it.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          replacedItems: { type: 'integer', description: 'Number of conversation items condensed into the summary; 0 means nothing was replaced.' },
          freedTokens: { type: 'integer', description: 'Estimated tokens the replaced range was costing.' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.replacedItems > 0
          ? `Compacted ${value.replacedItems} conversation items (~${value.freedTokens} tokens) into a summary above. That detail is no longer in context.`
          : 'Nothing to compact — no earlier history can be safely replaced yet.',
      }],
    },
    // No `isConcurrencySafe`: the compaction transaction asserts the WHOLE surface is unchanged across its summarization call, so a sibling tool landing its result mid-summary aborts it. Exclusive ordering is what makes that assertion hold.
    async execute(_args, exec) {
      const { agent } = exec
      if (agent === undefined) throw new Error('compact: no calling agent — compaction operates on an agent-owned session')
      // 'context-overflow', not 'pressure': pressure re-checks the configured threshold and returns null below it, which is exactly the case the model is calling here for. Overflow bypasses the threshold and forces one balanced reduction — the same thing `/compact` does.
      const result = await ctx.compaction.compactIfNeeded(agent, 'context-overflow', exec.signal)
      return result === null
        ? { replacedItems: 0, freedTokens: 0 }
        : { replacedItems: result.shadowedSeqs.length, freedTokens: result.shadowedTokenCount }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Compacting conversation history', kind: 'other', rawInput: args.reason }),
  }))
}
