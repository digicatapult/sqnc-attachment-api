import type express from 'express'
import type * as jwt from 'jsonwebtoken'

import mkExpressAuthentication, { AuthOptions } from '@digicatapult/tsoa-oauth-express'

import env from './env.js'
const { IDP_INTERNAL_URL_PREFIX, IDP_JWKS_PATH } = env

const exampleOptions: AuthOptions = {
  verifyOptions: {},
  jwksUri: () => Promise.resolve(`${IDP_INTERNAL_URL_PREFIX}${IDP_JWKS_PATH}`),
  getAccessToken: (req: express.Request) => Promise.resolve(req.headers['authorization']?.substring('bearer '.length)),
  getScopesFromToken: async (decoded: string | jwt.JwtPayload) => {
    const scopes = ((decoded as jwt.JwtPayload).scopes as string) || ''
    return scopes.split(' ')
  },
  tryRefreshTokens: () => Promise.resolve(false),
}

export const expressAuthentication = mkExpressAuthentication(exampleOptions)
