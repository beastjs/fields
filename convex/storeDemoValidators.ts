import { v } from 'convex/values'
export const storeProductValidator = v.object({
  sku: v.string(), name: v.string(), category: v.string(), price: v.number(), description: v.string(), detail: v.string(),
  specs: v.array(v.string()), color: v.string(), badge: v.string(), stock: v.number(), shape: v.number()
})
export const storeCartItemValidator = v.object({ sku: v.string(), quantity: v.number() })
export const storeOrderValidator = v.object({
  reference: v.string(), items: v.array(v.object({ sku: v.string(), name: v.string(), quantity: v.number(), unitPrice: v.number() })),
  subtotal: v.number(), shipping: v.number(), total: v.number(), delivery: v.union(v.literal('standard'), v.literal('express'))
})
