import { inject, singleton } from 'tsyringe'
import { z } from 'zod'

import { type Env, EnvToken } from '../env.js'
import { LoggerToken } from './logger.js'
import { type Logger } from 'pino'

const tokenResponseParser = z.object({
  access_token: z.string(),
})
type Token = z.infer<typeof tokenResponseParser>

const tokenIntrospectionParser = z.object({
  exp: z.number(),
})

@singleton()
export default class AuthInternal {
  tokenEndpoint: string
  introspectionEndpoint: string
  tokens: Token | null = null

  constructor(
    @inject(EnvToken) private env: Env,
    @inject(LoggerToken) private logger: Logger
  ) {
    this.tokenEndpoint = `${env.IDP_INTERNAL_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_INTERNAL_REALM}/protocol/openid-connect/token`
    this.introspectionEndpoint = `${env.IDP_INTERNAL_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_INTERNAL_REALM}/protocol/openid-connect/token/introspect`
  }

  public async getTokenExpirationDate(accessToken: string) {
    const introspectReq = await fetch(this.introspectionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: accessToken,
        client_id: this.env.IDP_INTERNAL_CLIENT_ID,
        client_secret: this.env.IDP_INTERNAL_CLIENT_SECRET,
      }),
    })

    if (!introspectReq.ok) {
      throw new Error(`Error getting token details from keycloak ${introspectReq.statusText}`)
    }

    const { exp: expirationEpochSeconds } = tokenIntrospectionParser.parse(await introspectReq.json())
    return new Date(expirationEpochSeconds * 1000)
  }

  public async getInternalAccessToken() {
    if (this.tokens !== null) {
      this.logger.trace('Using cached token')
      return this.tokens.access_token
    }

    this.logger.debug('Requesting new token for internal auth')
    const tokenReq = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.env.IDP_INTERNAL_CLIENT_ID,
        client_secret: this.env.IDP_INTERNAL_CLIENT_SECRET,
      }),
    })

    if (!tokenReq.ok) {
      throw new Error(`Error getting token from keycloak ${tokenReq.statusText}`)
    }

    const body = tokenResponseParser.parse(await tokenReq.json())
    const expiration = await this.getTokenExpirationDate(body.access_token)

    const msToExpire = expiration.getTime() - new Date().getTime()
    if (msToExpire < 0) {
      throw new Error('Token was already expired')
    }

    this.logger.debug('Token expires in %d ms', msToExpire)
    setTimeout(
      () => {
        this.logger.debug('Token expired, clearing cache')
        this.tokens = null
      },
      Math.max(msToExpire - 60000, 0)
    ) // 1 minute before expiration or immediately

    this.tokens = body
    return body.access_token
  }
}
