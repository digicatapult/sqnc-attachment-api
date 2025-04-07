import { type Logger } from 'pino'
import { type Env, EnvToken } from '../env.js'
import { LoggerToken } from './logger.js'
import { inject, singleton } from 'tsyringe'
import AuthInternal from './authInternal.js'
import { UUID } from '../models/strings.js'
import { Forbidden } from './error-handler/index.js'
import { z } from 'zod'

const responseBodyParser = z.object({
  result: z.object({
    allow: z.boolean(),
  }),
})

@singleton()
export default class Authz {
  private authzWebhook: string

  constructor(
    private authInternal: AuthInternal,
    @inject(EnvToken) private env: Env,
    @inject(LoggerToken) private logger: Logger
  ) {
    this.authzWebhook = this.env.AUTHZ_WEBHOOK
    if (!this.authzWebhook) {
      this.logger.warn('Authorization webhook is not configured. External access to attachments will always fail')
    }
  }

  public async authorize(id: UUID, organisationChainAccount: string) {
    this.logger.debug('Attempting to authorize access for address %s to attachment %s', organisationChainAccount, id)

    if (!this.authzWebhook) {
      this.logger.debug('Authorization failed due to webhook not being configured')
      throw new Forbidden()
    }

    const res = await fetch(this.authzWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `bearer ${await this.authInternal.getInternalAccessToken()}`,
      },
      body: JSON.stringify({
        input: {
          resourceType: 'attachment',
          resourceId: id,
          accountAddress: organisationChainAccount,
        },
      }),
    })

    if (!res.ok) {
      this.logger.debug('Authorization of account %s to access attachment %s failed', organisationChainAccount, id)
      if (res.status >= 500 && res.status < 600) {
        this.logger.error('Internal error authorizing account %s to access attachment %s', organisationChainAccount, id)
        this.logger.debug('Error was: %s', res.statusText)
      }
      throw new Forbidden()
    }

    const response = await res
      .json()
      .then(responseBodyParser.parse)
      .catch((err) => {
        this.logger.error('Authorization response did not match expected format')
        this.logger.debug('Details %s', '' + err)
        throw new Forbidden()
      })

    if (!response.result.allow) {
      this.logger.debug('Access by %s to attachment %s was disallowed by policy', organisationChainAccount, id)
      throw new Forbidden()
    }
  }
}
