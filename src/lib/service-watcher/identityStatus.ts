import { startStatusHandler } from './statusPoll.js'
import env from '../../env.js'
import Identity from '../identity.js'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env

const startIdentityStatus = () =>
  startStatusHandler({
    getStatus: Identity.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })

export default startIdentityStatus
