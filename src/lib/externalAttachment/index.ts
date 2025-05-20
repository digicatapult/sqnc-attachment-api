import { singleton } from 'tsyringe'
import { Logger } from 'pino'
import { logger } from '../logger.js'
import Identity from '../identity.js'
import env from '../../env.js'
import { AttachmentRow } from '../db/types.js'
import { z } from 'zod'
import contentDisposition from 'content-disposition'
import * as fs from 'fs'
import * as path from 'path'

const OidcConfigSchema = z.object({
  token_endpoint: z.string().url(),
})

const AccessTokenResponseSchema = z.object({
  access_token: z.string(),
})

type OidcConfig = z.infer<typeof OidcConfigSchema>

interface Credential {
  username: string
  secret: string
  owner: string
}

function loadCredentials(): Credential[] {
  const credentialsPath = path.resolve(process.cwd(), env.CREDENTIALS_FILE_PATH)
  const rawData = fs.readFileSync(credentialsPath, 'utf-8')
  return JSON.parse(rawData)
}

@singleton()
export class ExternalAttachmentService {
  private log: Logger

  constructor(private identity: Identity) {
    this.log = logger.child({ service: 'ExternalAttachment' })
  }

  async getOidcConfig(oidcConfigUrl: string): Promise<OidcConfig> {
    const response = await fetch(oidcConfigUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch OIDC configuration')
    }
    const data = await response.json()
    return OidcConfigSchema.parse(data)
  }

  async getAccessToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to obtain access token')
    }

    const data = await response.json()
    const validatedData = AccessTokenResponseSchema.parse(data)
    return validatedData.access_token
  }

  async fetchAttachment(attachmentUrl: string, accessToken: string) {
    try {
      const response = await fetch(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/octet-stream',
        },
      })
      const headers = response.headers
      const contentDispositionHeader = headers.get('content-disposition')
      const parsedDisposition = contentDispositionHeader ? contentDisposition.parse(contentDispositionHeader) : null
      const filename = parsedDisposition?.parameters.filename

      if (!response.ok) {
        throw new Error('Failed to fetch attachment')
      }
      const blobBuffer = Buffer.from(await response.arrayBuffer())
      return { blobBuffer, filename }
    } catch (err) {
      this.log.error('Error fetching attachment: %s', err instanceof Error ? err.message : 'unknown')
      throw err
    }
  }

  public async getAttachmentFromPeer(attachment: AttachmentRow) {
    const orgData = await this.identity.getOrganisationDataByAddress(attachment.owner)
    // preconfigure the oidc endpoints so I can connect to them
    const oidcConfig = await this.getOidcConfig(orgData.oidcConfigurationEndpointAddress)
    const creds = await this.getExternalCredentials(attachment.owner)
    const accessToken = await this.getAccessToken(oidcConfig.token_endpoint, creds.clientId, creds.clientSecret)

    const { blobBuffer, filename } = await this.fetchAttachment(
      `${orgData.attachmentEndpointAddress}/attachment/${attachment.integrity_hash}`,
      accessToken
    )

    return { blobBuffer, filename }
  }
  async getExternalCredentials(ownerId: string) {
    const credentialsData = loadCredentials()
    const credential = credentialsData.credentials.find((c) => c.owner === ownerId)

    if (!credential) {
      throw new Error(`No external credentials found for ownerId: ${ownerId}`)
    }

    return {
      clientId: credential.username,
      clientSecret: credential.secret,
    }
  }
}
