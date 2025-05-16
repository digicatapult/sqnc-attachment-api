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
    const response = await fetch(oidcConfigUrl)
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
          Accept: 'application/octet-stream',
        },
      })
      const headers = response.headers

      const filename = headers.get('content-disposition')?.split('filename=')[1]?.replace(/['"]/g, '')

      if (!response.ok) {
        console.log('response', response.body)
        console.log('status', response.status)
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
      `${orgData.attachmentEndpointAddress}/attachment/${attachment.id}`,
      accessToken
    )

    return { blobBuffer, filename }
  }
  async getExternalCredentials(ownerId: string) {
    const ownersArray = env.IDP_OWNERS.split(',')
    const secretsArray = env.IDP_EXTERNAL_CREDENTIAL_SECRETS.split(',')
    const index = ownersArray.indexOf(ownerId)
    if (index === -1) {
      throw new Error(`No external credentials found for ownerId: ${ownerId}`)
    }
    const [clientId, clientSecret] = secretsArray[index].split(':')
    return { clientId, clientSecret }
  }
}
