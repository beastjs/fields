import { v, ConvexError } from 'convex/values'
import { query, mutation, internalMutation } from './_generated/server'
import { storeProducts } from '../src/playground/fullstack/products'
import { storeProductValidator, storeCartItemValidator, storeOrderValidator } from './storeDemoValidators'
import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter'
import { components } from './_generated/api'

const limits = new RateLimiter(components.rateLimiter, {
  storeDemo: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 30 }
})
const tokenValidator = (token: string) => {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ConvexError('Invalid demo session. Reload this example.')
}
const summarizeOrder = (order: { reference: string; items: { sku: string; name: string; quantity: number; unitPrice: number }[]; subtotal: number; shipping: number; total: number; delivery: 'standard' | 'express' }) => ({
  reference: order.reference, items: order.items, subtotal: order.subtotal, shipping: order.shipping, total: order.total, delivery: order.delivery
})

export const products = query({
  args: {}, returns: v.array(storeProductValidator),
  handler: async ctx => {
    const rows = await ctx.db.query('storeDemoProducts').withIndex('by_sku').take(60)
    return rows.map(({ _id, _creationTime, ...product }) => product)
  }
})

export const session = query({
  args: { token: v.string() },
  returns: v.object({ items: v.array(storeCartItemValidator), order: v.union(v.null(), storeOrderValidator) }),
  handler: async (ctx, { token }) => {
    tokenValidator(token)
    const cart = await ctx.db.query('storeDemoCarts').withIndex('by_token', q => q.eq('token', token)).unique()
    const order = await ctx.db.query('storeDemoOrders').withIndex('by_token', q => q.eq('token', token)).order('desc').first()
    return { items: cart?.items ?? [], order: order ? summarizeOrder(order) : null }
  }
})

export const setQuantity = mutation({
  args: { token: v.string(), sku: v.string(), quantity: v.number() }, returns: v.array(storeCartItemValidator),
  handler: async (ctx, { token, sku, quantity }) => {
    tokenValidator(token)
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10) throw new ConvexError('Choose a quantity from 0 to 10.')
    const product = await ctx.db.query('storeDemoProducts').withIndex('by_sku', q => q.eq('sku', sku)).unique()
    if (!product) throw new ConvexError('This product is no longer available.')
    if (quantity > product.stock) throw new ConvexError('This quantity is not available.')
    await limits.limit(ctx, 'storeDemo', { key: token, throws: true })
    const cart = await ctx.db.query('storeDemoCarts').withIndex('by_token', q => q.eq('token', token)).unique()
    const items = (cart?.items ?? []).filter(item => item.sku !== sku)
    if (quantity) items.push({ sku, quantity })
    if (items.length > 36) throw new ConvexError('The demo cart is full.')
    if (cart) await ctx.db.patch(cart._id, { items, updatedAt: Date.now() })
    else if (items.length) await ctx.db.insert('storeDemoCarts', { token, items, updatedAt: Date.now() })
    return items
  }
})

/** No payment or personal details: this endpoint only records an explicitly simulated order. */
export const checkout = mutation({
  args: { token: v.string(), requestId: v.string(), delivery: v.union(v.literal('standard'), v.literal('express')) },
  returns: storeOrderValidator,
  handler: async (ctx, { token, requestId, delivery }) => {
    tokenValidator(token)
    if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new ConvexError('Invalid checkout request.')
    const previous = await ctx.db.query('storeDemoOrders').withIndex('by_token_and_requestId', q => q.eq('token', token).eq('requestId', requestId)).unique()
    if (previous) return summarizeOrder(previous)
    await limits.limit(ctx, 'storeDemo', { key: token, throws: true })
    const cart = await ctx.db.query('storeDemoCarts').withIndex('by_token', q => q.eq('token', token)).unique()
    if (!cart?.items.length) throw new ConvexError('Add something to your bag first.')
    const items = await Promise.all(cart.items.map(async item => {
      const product = await ctx.db.query('storeDemoProducts').withIndex('by_sku', q => q.eq('sku', item.sku)).unique()
      if (!product || item.quantity > product.stock || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw new ConvexError('An item in your bag is unavailable. Update your bag and try again.')
      return { sku: item.sku, name: product.name, quantity: item.quantity, unitPrice: product.price }
    }))
    const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
    const shipping = delivery === 'express' ? 2500 : subtotal >= 15000 ? 0 : 900
    const order = { reference: 'FS-' + requestId.slice(0, 8).toUpperCase(), items, subtotal, shipping, total: subtotal + shipping, delivery }
    await ctx.db.insert('storeDemoOrders', { ...order, token, requestId })
    await ctx.db.patch(cart._id, { items: [], updatedAt: Date.now() })
    return order
  }
})

export const seed = internalMutation({
  args: {}, returns: v.number(),
  handler: async ctx => {
    for (const product of storeProducts) {
      const existing = await ctx.db.query('storeDemoProducts').withIndex('by_sku', q => q.eq('sku', product.sku)).unique()
      if (existing) await ctx.db.patch(existing._id, product)
      else await ctx.db.insert('storeDemoProducts', product)
    }
    return storeProducts.length
  }
})
