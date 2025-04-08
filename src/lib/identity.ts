import { container, singleton } from 'tsyringe'
import { z } from 'zod'

import { NotFound, HttpResponse } from './error-handler/index.js'
import env from '../env.js'
import { Status, serviceState } from './service-watcher/statusPoll.js'
import { logger } from './logger.js'
import AuthInternal from './authInternal.js'

const identityResponseValidator = z.object({
  address: z.string(),
  alias: z.string(),
})
type IdentityResponse = z.infer<typeof identityResponseValidator>

const identityHealthValidator = z.object({
  version: z.string(),
  status: z.literal('ok'),
})
type IdentityHealthResponse = z.infer<typeof identityHealthValidator>

@singleton()
export default class Identity {
  private URL_PREFIX: string

  constructor(private auth: AuthInternal) {
    this.URL_PREFIX = `http://${env.IDENTITY_SERVICE_HOST}:${env.IDENTITY_SERVICE_PORT}`
  }

  static getStatus = async (): Promise<Status> => {
    const identity = container.resolve(Identity)
    try {
      const res = await identity.getHealth()
      if (res) {
        if (!res.version.match(/\d+.\d+.\d+/)) {
          return {
            status: serviceState.DOWN,
            detail: {
              message: 'Error getting status from Identity service',
            },
          }
        }
        return {
          status: serviceState.UP,
          detail: {
            version: res.version,
          },
        }
      }
      throw new Error()
    } catch (err) {
      logger.debug('Identity service status error: %s', err instanceof Error ? err.message : 'unknown')
      return {
        status: serviceState.DOWN,
        detail: {
          message: 'Error getting status from Identity service',
        },
      }
    }
  }
  getMemberByAlias = async (alias: string): Promise<IdentityResponse> => {
    const res = await fetch(`${this.URL_PREFIX}/v1/members/${encodeURIComponent(alias)}`, {
      headers: {
        authorization: `bearer ${await this.auth.getInternalAccessToken()}`,
      },
    })

    if (res.ok) {
      return identityResponseValidator.parse(await res.json())
    }

    if (res.status === 404) {
      throw new NotFound(`identity: ${alias}`)
    }

    throw new HttpResponse({})
  }

  getHealth = async (): Promise<IdentityHealthResponse> => {
    const res = await fetch(`${this.URL_PREFIX}/health`)

    if (res.ok) {
      return identityHealthValidator.parse(await res.json())
    }

    throw new HttpResponse({})
  }

  getMemberBySelf = async (): Promise<IdentityResponse> => {
    const res = await fetch(`${this.URL_PREFIX}/v1/self`, {
      headers: {
        authorization: `bearer ${await this.auth.getInternalAccessToken()}`,
      },
    })

    if (res.ok) {
      return identityResponseValidator.parse(await res.json())
    }

    throw new HttpResponse({})
  }

  getMemberByAddress = (alias: string) => this.getMemberByAlias(alias)
}
