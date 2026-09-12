import { defineSchema, defineTable } from 'convex/server'
import { userValidator } from './users/v'

export default defineSchema({
  users: defineTable(userValidator)
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_firebaseUid', ['firebaseUid'])
    .index('by_email', ['email'])
})
