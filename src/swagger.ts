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
  const tokenUrl = `${env.IDP_PUBLIC_URL_PREFIX}${env.IDP_TOKEN_PATH}`

  const swaggerBuffer = await fs.readFile(path.join(__dirname, './swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))
  swaggerJson.info.title += `:${API_SWAGGER_HEADING}`
  swaggerJson.components.securitySchemes.oauth2.flows.clientCredentials.tokenUrl = tokenUrl
  swaggerJson.components.securitySchemes.oauth2.flows.clientCredentials.refreshUrl = tokenUrl

  return swaggerJson
}
