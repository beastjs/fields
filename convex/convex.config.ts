import agent from '@convex-dev/agent/convex.config'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    /** Where published sites answer, with `{slug}`: `https://{slug}.playsites.dev`. See convex/siteSlugs.ts. */
    HOSTING_SITE_URL: v.optional(v.string()),
    /** The hosting Worker's admin origin (its workers.dev URL) and bearer token. See hosting/README.md. */
    HOSTING_ADMIN_URL: v.optional(v.string()),
    HOSTING_ADMIN_TOKEN: v.optional(v.string())
  }
})
app.use(agent)

export default app
