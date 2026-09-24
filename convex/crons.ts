import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Fails uploads that never finished and removes files nobody can reach any more. See convex/publishing.ts.
crons.interval('sweep hosting deployments', { hours: 1 }, internal.publishing.sweep, {})

export default crons
