import { storeProductValidator, storeCartItemValidator, storeOrderValidator } from './storeDemoValidators'
import { v } from 'convex/values'
import { defineSchema, defineTable } from 'convex/server'
import { userValidator } from './users/v'
import {
  buildRunValidator,
  chatValidator,
  deploymentValidator,
  pageRecipeValidator,
  projectFileValidator,
  projectLogValidator,
  projectValidator,
  sectionPresetValidator,
  siteValidator,
  teamInvitationValidator,
  teamMemberValidator,
  teamValidator,
  themeValidator
} from './validators'

export default defineSchema({
  storeDemoProducts: defineTable(storeProductValidator).index('by_sku', ['sku']),
  storeDemoCarts: defineTable({ token: v.string(), items: v.array(storeCartItemValidator), updatedAt: v.number() }).index('by_token', ['token']),
  storeDemoOrders: defineTable({ ...storeOrderValidator.fields, token: v.string(), requestId: v.string() })
    .index('by_token', ['token']).index('by_token_and_requestId', ['token', 'requestId']),

  marginDemoProducts: defineTable(storeProductValidator).index('by_sku', ['sku']),
  marginDemoCarts: defineTable({ token: v.string(), items: v.array(storeCartItemValidator), updatedAt: v.number() }).index('by_token', ['token']),
  marginDemoOrders: defineTable({ ...storeOrderValidator.fields, token: v.string(), requestId: v.string() })
    .index('by_token', ['token']).index('by_token_and_requestId', ['token', 'requestId']),
  marginDemoShelves: defineTable({ token: v.string(), skus: v.array(v.string()) }).index('by_token', ['token']),

  users: defineTable(userValidator)
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_firebaseUid', ['firebaseUid'])
    .index('by_email', ['email']),

  teams: defineTable(teamValidator)
    .index('by_personalOwnerId', ['personalOwnerId'])
    .index('by_updatedAt', ['updatedAt']),

  teamMembers: defineTable(teamMemberValidator)
    .index('by_teamId', ['teamId'])
    .index('by_userId', ['userId'])
    .index('by_teamId_and_userId', ['teamId', 'userId'])
    .index('by_teamId_and_role', ['teamId', 'role']),

  teamInvitations: defineTable(teamInvitationValidator)
    .index('by_teamId_and_createdAt', ['teamId', 'createdAt'])
    .index('by_teamId_and_email', ['teamId', 'email'])
    .index('by_email_and_status', ['email', 'status']),

  projects: defineTable(projectValidator)
    .index('by_teamId_and_updatedAt', ['teamId', 'updatedAt'])
    .index('by_teamId_and_isDefault', ['teamId', 'isDefault'])
    .index('by_createdBy_and_updatedAt', ['createdBy', 'updatedAt']),

  projectFiles: defineTable(projectFileValidator)
    .index('by_projectId', ['projectId'])
    .index('by_projectId_and_path', ['projectId', 'path'])
    .index('by_projectId_and_updatedAt', ['projectId', 'updatedAt']),

  chats: defineTable(chatValidator)
    .index('by_projectId_and_updatedAt', ['projectId', 'updatedAt'])
    .index('by_agentThreadId', ['agentThreadId'])
    .index('by_createdBy_and_updatedAt', ['createdBy', 'updatedAt']),

  buildRuns: defineTable(buildRunValidator)
    .index('by_projectId_and_startedAt', ['projectId', 'startedAt'])
    .index('by_projectId_and_status', ['projectId', 'status']),

  projectLogs: defineTable(projectLogValidator)
    .index('by_projectId_and_occurredAt', ['projectId', 'occurredAt'])
    .index('by_projectId_and_source_and_occurredAt', ['projectId', 'source', 'occurredAt'])
    .index('by_buildId_and_occurredAt', ['buildId', 'occurredAt']),

  sites: defineTable(siteValidator)
    .index('by_slug', ['slug'])
    .index('by_projectId', ['projectId']),

  deployments: defineTable(deploymentValidator)
    .index('by_projectId_and_createdAt', ['projectId', 'createdAt'])
    .index('by_status_and_createdAt', ['status', 'createdAt']),

  sectionPresets: defineTable(sectionPresetValidator)
    .index('by_presetId', ['presetId'])
    .index('by_teamId_and_status_and_kind', ['teamId', 'status', 'kind'])
    .index('by_teamId_and_updatedAt', ['teamId', 'updatedAt'])
    .searchIndex('search_catalog', { searchField: 'searchText', filterFields: ['status', 'kind', 'teamId'] }),

  themes: defineTable(themeValidator)
    .index('by_themeId', ['themeId'])
    .index('by_status', ['status'])
    .index('by_teamId_and_updatedAt', ['teamId', 'updatedAt']),

  pageRecipes: defineTable(pageRecipeValidator)
    .index('by_recipeId', ['recipeId'])
    .index('by_status', ['status'])
    .index('by_teamId_and_updatedAt', ['teamId', 'updatedAt'])
})
