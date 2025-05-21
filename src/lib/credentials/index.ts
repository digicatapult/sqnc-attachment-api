import * as fs from 'fs'
import * as path from 'path'
import env from '../../env.js'
import { singleton } from 'tsyringe'
import { logger } from '../logger.js'
import { Logger } from 'pino'

export interface Credential {
  username: string
  secret: string
  owner: string
}

@singleton()
export class Credentials {
  private log: Logger

  constructor() {
    this.log = logger.child({ module: 'Credentials' })
  }

  async getCredentialsForOwner(ownerId: string): Promise<{ clientId: string; clientSecret: string }> {
    const credentialsData = this.loadCredentials()
    const credentials = credentialsData.filter((c) => c.owner === ownerId)

    if (credentials.length === 0) {
      throw new Error(`No external credentials found for ownerId: ${ownerId}`)
    }

    // Take the first credential if multiple exist
    const credential = credentials[0]
    return {
      clientId: credential.username,
      clientSecret: credential.secret,
    }
  }

  private loadCredentials(): Credential[] {
    const credentialsPath = path.resolve(process.cwd(), env.CREDENTIALS_FILE_PATH)
    this.log.info('Loading credentials from path: %s', credentialsPath)

    const rawData = fs.readFileSync(credentialsPath, 'utf-8')
    this.log.debug('Successfully read credentials file, size: %d bytes', rawData.length)

    try {
      const parsed = JSON.parse(rawData)
      if (!parsed.credentials || !Array.isArray(parsed.credentials)) {
        throw new Error('Invalid credentials file format. Expected { credentials: [] }')
      }
      this.log.info('Successfully loaded %d credentials', parsed.credentials.length)
      return parsed.credentials
    } catch (parseError) {
      throw new Error(
        `Failed to parse credentials file: ${parseError instanceof Error ? parseError.message : 'unknown error'}`
      )
    }
  }
}
