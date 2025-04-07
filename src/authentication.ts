import type express from 'express'

import mkExpressAuthentication, { mergeAcceptAny } from '@digicatapult/tsoa-oauth-express'

import env from './env.js'

export const expressAuthentication = mergeAcceptAny([
  mkExpressAuthentication({
    verifyOptions: {},
    securityName: 'oauth2',
    jwksUri: () =>
      Promise.resolve(
        `${env.IDP_INTERNAL_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_OAUTH2_REALM}/protocol/openid-connect/certs`
      ),
    getAccessToken: (req: express.Request) =>
      Promise.resolve(req.headers['authorization']?.substring('bearer '.length)),
    getScopesFromToken: async (decoded) => {
      const scopes = typeof decoded === 'string' ? '' : `${decoded.scopes}`
      return scopes.split(' ')
    },
  }),
  mkExpressAuthentication({
    verifyOptions: {},
    securityName: 'internal',
    jwksUri: () =>
      Promise.resolve(
        `${env.IDP_INTERNAL_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_INTERNAL_REALM}/protocol/openid-connect/certs`
      ),
    getAccessToken: (req: express.Request) =>
      Promise.resolve(req.headers['authorization']?.substring('bearer '.length)),
    getScopesFromToken: async (decoded) => {
      const scopes = typeof decoded === 'string' ? '' : `${decoded.scopes}`
      return scopes.split(' ')
    },
  }),
  mkExpressAuthentication({
    verifyOptions: {},
    securityName: 'external',
    jwksUri: () =>
      Promise.resolve(
        `${env.IDP_INTERNAL_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_EXTERNAL_REALM}/protocol/openid-connect/certs`
      ),
    getAccessToken: (req: express.Request) =>
      Promise.resolve(req.headers['authorization']?.substring('bearer '.length)),
    getScopesFromToken: async (decoded) => {
      const scopes = typeof decoded === 'string' ? '' : `${decoded.scopes}`
      return scopes.split(' ')
    },
  }),
])
