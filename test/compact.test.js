import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import Tools from '@deepseek-ai/dsh-tools'
import * as compact from '../lib/index.js'

test('compact uses the caller and cancellation signal, preserves result mapping, and unloads', async () => {
  const ctx = new Context()
  ctx.provide('systemPrompt', { tools() {} })
  const tools = new Tools(ctx)
  let result = null
  const agent = {}, signal = new AbortController().signal, calls = []
  ctx.provide('compaction', { compactIfNeeded: async (...args) => { calls.push(args); return result } })
  const fiber = ctx.plugin(compact)
  try {
    await fiber.await()
    const tool = tools.get('compact')
    assert.ok(tool)
    assert.equal(tool.isConcurrencySafe, undefined)
    const exec = { agent, signal }
    assert.deepEqual(await tool.execute({}, exec), { replacedItems: 0, freedTokens: 0 })
    result = { shadowedSeqs: [2, 3, 4], shadowedTokenCount: 123 }
    assert.deepEqual(await tool.execute({}, exec), { replacedItems: 3, freedTokens: 123 })
    assert.deepEqual(calls, [[agent, 'context-overflow', signal], [agent, 'context-overflow', signal]])
    await assert.rejects(tool.execute({}, { signal }), /no calling agent/)
    ctx.compaction.compactIfNeeded = async () => { throw signal.reason ?? new Error('backend failed') }
    await assert.rejects(tool.execute({}, exec), /backend failed/)
  } finally {
    await fiber.dispose()
    assert.equal(tools.get('compact'), undefined)
    await ctx.fiber.dispose()
  }
})

test('installation outside the compaction realm stays inactive', async () => {
  const ctx = new Context()
  ctx.provide('systemPrompt', { tools() {} })
  const tools = new Tools(ctx)
  const fiber = ctx.plugin(compact)
  try {
    await fiber.await()
    assert.equal(tools.get('compact'), undefined)
  } finally {
    await fiber.dispose()
    await ctx.fiber.dispose()
  }
})
