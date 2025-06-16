import { startStatusHandler } from './statusPoll.js'
import env from '../../env.js'
import Ipfs, { isIpfsEnv } from '../ipfs.js'
import { logger } from '../logger.js'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env

let ipfs: Ipfs | undefined

if (isIpfsEnv(env)) {
  ipfs = new Ipfs({ host: env.IPFS_HOST, port: env.IPFS_PORT, logger })
}

const startIpfsStatus = () => {
  if (!ipfs) return
  return startStatusHandler({
    getStatus: ipfs.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })
}

export default startIpfsStatus
