import { v } from 'convex/values'

export const userFields = {
  tokenIdentifier: v.string(),
  firebaseUid: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  subject: v.string(),
  issuer: v.string(),
  nickname: v.union(v.string(), v.null()),
  preferredUsername: v.union(v.string(), v.null()),
  profileUrl: v.optional(v.string()),
  phone: v.union(v.string(), v.null()),
  emailVerified: v.union(v.boolean(), v.null())
}

export const userUpsertSchema = v.object(userFields)

export const userValidator = v.object({
  ...userFields,
  createdAt: v.number(),
  updatedAt: v.number()
})

export type UserIdentity = typeof userValidator.type
export type UserUpsertInput = typeof userUpsertSchema.type
