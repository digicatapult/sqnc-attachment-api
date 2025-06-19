import { startStatusHandler } from './statusPoll.js'
import env from '../../env.js'
import Ipfs from '../ipfs.js'
import StorageClass, { StorageToken } from '../storageClass/index.js'
import { container } from 'tsyringe'

const { WATCHER_POLL_PERIOD_MS, WATCHER_TIMEOUT_MS } = env

const startStorageStatus = () => {
  const storage: Ipfs | StorageClass = container.resolve(StorageToken)

  return startStatusHandler({
    getStatus: storage.getStatus,
    pollingPeriodMs: WATCHER_POLL_PERIOD_MS,
    serviceTimeoutMs: WATCHER_TIMEOUT_MS,
  })
}

export default startStorageStatus
