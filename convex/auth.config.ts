import type { AuthConfig } from 'convex/server'

// Firebase project IDs are public configuration (they are also shipped to the
// browser). Firebase ID tokens use this value for both issuer and audience.
const projectId = 'fields-btsx'

export default {
  providers: [
    {
      domain: `https://securetoken.google.com/${projectId}`,
      applicationID: projectId
    }
  ]
} satisfies AuthConfig
