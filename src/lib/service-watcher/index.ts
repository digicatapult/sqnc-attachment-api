import { singleton } from 'tsyringe'

import startIpfsStatus from './ipfsStatus.js'
import { buildCombinedHandler, SERVICE_STATE, Status } from './statusPoll.js'
import startIdentityStatus from './identityStatus.js'

@singleton()
export class ServiceWatcher {
  handlersP: Promise<{
    readonly status: SERVICE_STATE
    readonly detail: {
      [k: string]: Status
    }
    close: () => void
  }>

  constructor() {
    this.handlersP = this.build()
  }

  private build = async (): Promise<{
    readonly status: SERVICE_STATE
    readonly detail: {
      [k: string]: Status
    }
    close: () => void
  }> => {
    const handlers = new Map()
    const [ipfsStatus, identityStatus] = await Promise.all([startIpfsStatus(), startIdentityStatus()])

    handlers.set('ipfs', ipfsStatus)
    handlers.set('identity', identityStatus)

    return buildCombinedHandler(handlers)
  }

  public get status(): Promise<SERVICE_STATE> {
    return this.handlersP.then(({ status }) => status)
  }

  public get detail() {
    return this.handlersP.then(({ detail }) => detail)
  }

  public async close() {
    const handlers = await this.handlersP
    handlers.close()
  }
}
