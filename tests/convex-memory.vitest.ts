import { expect, test } from 'vitest'
import { defineTestApp } from 'convex-test'
import schema from '../convex/schema'
import * as projectMemory from '../convex/projectMemory'
import { VictralMemory } from '../src/chat/memory'

const app = defineTestApp({ schema }).defineModules({ projectMemory })
async function setup() {
  const t = app.createTest()
  const ids = await t.run(async ctx => {
    const user = async (name: string) => ctx.db.insert('users', {
      tokenIdentifier: `issuer|${name}`, firebaseUid: name, subject: name, issuer: 'issuer', nickname: null,
      preferredUsername: null, phone: null, emailVerified: null, createdAt: 1, updatedAt: 1
    })
    const owner = await user('owner'), stranger = await user('stranger')
    const team = await ctx.db.insert('teams', { name: 'Team', kind: 'shared', createdBy: owner, createdAt: 1, updatedAt: 1 })
    await ctx.db.insert('teamMembers', { teamId: team, userId: owner, role: 'owner', joinedAt: 1 })
    const project = (name: string) => ctx.db.insert('projects', {
      teamId: team, name, createdBy: owner, isDefault: false, entryPath: '/main.ts', activeFilePath: '/main.ts',
      previewWidth: '100%', revision: 0, createdAt: 1, updatedAt: 1
    })
    return { a: await project('A'), b: await project('B'), stranger }
  })
  return { t, ids, owner: t.withIdentity({ tokenIdentifier: 'issuer|owner' }), stranger: t.withIdentity({ tokenIdentifier: 'issuer|stranger' }) }
}

test('project memory persists independently and enforces membership on every read and write', async () => {
  const { t, ids, owner, stranger } = await setup()
  const memory = new VictralMemory(); memory.append('user', 'Project A secret')
  const args = { projectId: ids.a, expectedRevision: 0, state: memory.state(), roots: memory.roots, nodes: [] }
  expect(await owner.mutation(app.api.projectMemory.save, args)).toBe(1)
  expect((await owner.query(app.api.projectMemory.get, { projectId: ids.a }))!.state.count).toBe(1)
  expect(await owner.query(app.api.projectMemory.get, { projectId: ids.b })).toBeNull()
  const page = { projectId: ids.a, revision: 1, paginationOpts: { cursor: null, numItems: 10 } }
  expect((await owner.query(app.api.projectMemory.listRecords, page)).page[0].record).toMatchObject({ kind: 'root', value: { text: 'Project A secret' } })
  await expect(stranger.query(app.api.projectMemory.get, { projectId: ids.a })).rejects.toThrow('access')
  await expect(stranger.query(app.api.projectMemory.listRecords, page)).rejects.toThrow('access')
  await expect(stranger.mutation(app.api.projectMemory.save, { ...args, expectedRevision: 1, roots: [] })).rejects.toThrow('access')
  await expect(t.query(app.api.projectMemory.get, { projectId: ids.a })).rejects.toThrow('Sign in')
})

test('stale revisions and invalid writes roll back without losing originals', async () => {
  const { ids, owner } = await setup()
  const memory = new VictralMemory(); memory.append('user', 'Keep original')
  const args = { projectId: ids.a, expectedRevision: 0, state: memory.state(), roots: memory.roots, nodes: [] }
  await owner.mutation(app.api.projectMemory.save, args)
  await expect(owner.mutation(app.api.projectMemory.save, args)).rejects.toThrow('Another tab')
  await expect(owner.query(app.api.projectMemory.listRecords, { projectId: ids.a, revision: 0, paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow('changed')
  await expect(owner.mutation(app.api.projectMemory.save, { ...args, expectedRevision: 1, roots: [], state: { ...args.state, count: 2 } })).rejects.toThrow('size')
  await expect(owner.mutation(app.api.projectMemory.save, { ...args, expectedRevision: 1, roots: [], state: { ...args.state, compactView: [{ l: 0, i: 0 }] } })).rejects.toThrow('Missing memory summary')
  const node = { l: 0, i: 0, text: 'Summary' }
  await owner.mutation(app.api.projectMemory.save, { ...args, expectedRevision: 1, roots: [], nodes: [node] })
  await expect(owner.mutation(app.api.projectMemory.save, { ...args, expectedRevision: 2, roots: [], nodes: [{ ...node, text: 'Overwritten' }] })).rejects.toThrow('immutable')
  expect((await owner.query(app.api.projectMemory.get, { projectId: ids.a }))!.revision).toBe(2)
})
