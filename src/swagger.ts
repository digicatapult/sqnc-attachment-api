import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import env from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Monkey-patch the generated swagger JSON so that when it is valid for the deployed environment
 * @param env Environment containing configuration for monkey-patching the swagger
 * @returns OpenAPI spec object
 */
export default async function loadApiSpec(): Promise<unknown> {
  const API_SWAGGER_HEADING = env.API_SWAGGER_HEADING

  const swaggerBuffer = await fs.readFile(path.join(__dirname, './swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))
  swaggerJson.info.title += `:${API_SWAGGER_HEADING}`

  const tokenUrlOauth = `${env.IDP_PUBLIC_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_OAUTH2_REALM}/protocol/openid-connect/token`
  swaggerJson.components.securitySchemes.oauth2.flows.clientCredentials.tokenUrl = tokenUrlOauth
  swaggerJson.components.securitySchemes.oauth2.flows.clientCredentials.refreshUrl = tokenUrlOauth

  const tokenUrlInternal = `${env.IDP_PUBLIC_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_INTERNAL_REALM}/protocol/openid-connect/token`
  swaggerJson.components.securitySchemes.internal.flows.clientCredentials.tokenUrl = tokenUrlInternal
  swaggerJson.components.securitySchemes.internal.flows.clientCredentials.refreshUrl = tokenUrlInternal

  const tokenUrExternal = `${env.IDP_PUBLIC_ORIGIN}${env.IDP_PATH_PREFIX}/realms/${env.IDP_EXTERNAL_REALM}/protocol/openid-connect/token`
  swaggerJson.components.securitySchemes.external.flows.clientCredentials.tokenUrl = tokenUrExternal
  swaggerJson.components.securitySchemes.external.flows.clientCredentials.refreshUrl = tokenUrExternal

  // if we're in production, remove the internal security scheme and references to it
  if (process.env.NODE_ENV !== 'dev') {
    delete swaggerJson.components.securitySchemes.internal
    delete swaggerJson.components.securitySchemes.external
    Object.entries<object>(swaggerJson.paths).forEach(([, methods]) => {
      Object.entries(methods).forEach(([, method]) => {
        const security: unknown[] = method.security

        method.security = security.filter((security) => {
          return security && typeof security === 'object' && 'oauth2' in security
        })
      })
    })
  }

  return swaggerJson
}
