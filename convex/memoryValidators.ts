import { v } from 'convex/values'

export const memoryPart = v.object({ l: v.number(), i: v.number() })
export const memoryRoot = v.object({ role: v.union(v.literal('user'), v.literal('assistant')), text: v.string(), date: v.number() })
export const memoryNode = v.object({ ...memoryPart.fields, text: v.string() })
export const memoryState = v.object({
  version: v.literal(1), count: v.number(), view: v.array(memoryPart), shrinking: v.boolean(),
  compactView: v.array(memoryPart), compactShrinking: v.boolean()
})
export const memoryRecord = v.union(
  v.object({ kind: v.literal('root'), index: v.number(), value: memoryRoot }),
  v.object({ kind: v.literal('node'), value: memoryNode })
)
