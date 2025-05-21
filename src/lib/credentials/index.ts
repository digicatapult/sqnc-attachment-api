import * as fs from 'fs'
import * as path from 'path'
import env, { Env } from '../../env.js'
import { singleton } from 'tsyringe'
import { logger } from '../logger.js'
import { Logger } from 'pino'
import { z } from 'zod'

const CredentialSchema = z.object({
  username: z.string(),
  secret: z.string(),
  owner: z.string(),
})

const CredentialsFileSchema = z.object({
  credentials: z.array(CredentialSchema),
})

type Credential = z.infer<typeof CredentialSchema>

@singleton()
export class Credentials {
  private log: Logger
  private env: Env
  private credentialsMap: Map<string, Credential>

  constructor() {
    this.log = logger.child({ module: 'Credentials' })
    this.env = env
    this.credentialsMap = new Map()
  }

  async getCredentialsForOwner(ownerId: string): Promise<{ clientId: string; clientSecret: string }> {
    if (this.credentialsMap.size === 0) {
      const credentialsData = this.loadCredentials()
      // Store all credentials in the map
      credentialsData.forEach((cred) => {
        this.credentialsMap.set(cred.owner, cred)
      })
    }
    const credential = this.credentialsMap.get(ownerId)
    if (!credential) {
      throw new Error(`No external credentials found for ownerId: ${ownerId}`)
    }
    return {
      clientId: credential.username,
      clientSecret: credential.secret,
    }
  }

  private loadCredentials(): Credential[] {
    const credentialsPath = this.getCredentialsPath(this.env)
    this.log.info('Loading credentials from path: %s', credentialsPath)

    const rawData = this.readCredentialsFile(credentialsPath)
    this.log.debug('Successfully read credentials file, size: %d bytes', rawData.length)

    try {
      const parsed = JSON.parse(rawData)
      const validated = CredentialsFileSchema.parse(parsed)
      this.log.info('Successfully loaded %d credentials', validated.credentials.length)
      return validated.credentials
    } catch (parseError) {
      if (parseError instanceof z.ZodError) {
        throw new Error(`Invalid credentials file format: ${parseError.message}`)
      }
      throw new Error(
        `Failed to parse credentials file: ${parseError instanceof Error ? parseError.message : 'unknown error'}`
      )
    }
  }

  getCredentialsPath(env: Env) {
    return path.resolve(process.cwd(), env.CREDENTIALS_FILE_PATH)
  }

  readCredentialsFile(filePath: string) {
    return fs.readFileSync(filePath, 'utf-8')
  }
}
