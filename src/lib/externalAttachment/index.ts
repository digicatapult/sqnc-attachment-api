import { singleton } from 'tsyringe'
import { Logger } from 'pino'
import { logger } from '../logger.js'
import Identity from '../identity.js'
import env from '../../env.js'
import { AttachmentRow } from '../db/types.js'

@singleton()
export class ExternalAttachmentService {
  private log: Logger

  constructor(private identity: Identity) {
    this.log = logger.child({ service: 'ExternalAttachment' })
  }

  async getOidcConfig(oidcConfigUrl: string) {
    const response = await fetch(`${oidcConfigUrl}/sequence/.well-known/openid-configuration`)
    if (!response.ok) {
      throw new Error('Failed to fetch OIDC configuration')
    }
    return response.json()
  }

  async getAccessToken(tokenUrl: string, clientId: string, clientSecret: string) {
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
    return data.access_token
  }

  async fetchAttachment(attachmentUrl: string, accessToken: string) {
    try {
      const response = await fetch(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch attachment')
      }
      const blobBuffer = Buffer.from(await response.arrayBuffer())
      return blobBuffer
    } catch (err) {
      this.log.error('Error fetching attachment: %s', err instanceof Error ? err.message : 'unknown')
      throw err
    }
  }

  public async getAttachmentFromPeer(attachment: AttachmentRow): Promise<Buffer<ArrayBuffer>> {
    const orgData = await this.identity.getOrganisationDataByAddress(attachment.owner)
    // preconfigure the oidc endpoints so I can connect to them
    const oidcConfig = await this.getOidcConfig(orgData.oidcConfigurationEndpointAddress)
    const accessToken = await this.getAccessToken(
      oidcConfig.token_endpoint,
      env.IDP_INTERNAL_CLIENT_ID,
      env.IDP_INTERNAL_CLIENT_SECRET
    )

    const attachmentBlob = await this.fetchAttachment(
      `${orgData.attachmentEndpointAddress}/attachment/${attachment.id}`,
      accessToken
    )

    return attachmentBlob
  }
}
