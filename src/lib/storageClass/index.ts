import { type Logger } from 'pino'
import { inject, injectable } from 'tsyringe'
import { LoggerToken } from '../logger.js'
import { StorageType, Storage, StorageAdapterConfig } from '@tweedegolf/storage-abstraction'
import { AzureEnv, type Env, EnvToken, S3Env } from '../../env.js'
import { ResultObjectStream } from '@tweedegolf/storage-abstraction/dist/types/result.js'
import { NotFound } from '../error-handler/index.js'
import { createHash } from 'crypto'
import { serviceState } from '../service-watcher/statusPoll.js'

export const StorageToken = Symbol('StorageToken')
@injectable()
export default class StorageClass {
  private storage: Storage
  private config: StorageAdapterConfig | undefined
  constructor(
    @inject(EnvToken) private env: S3Env | AzureEnv,
    @inject(LoggerToken) private logger: Logger
  ) {
    if (!isS3Env(env) && !isAzureEnv(env)) {
      throw new Error('Invalid storage mode')
    }
    if (isS3Env(env)) {
      this.config = {
        type: StorageType.S3, // localstack and minio config
        accessKeyId: env.STORAGE_BACKEND_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_BACKEND_SECRET_ACCESS_KEY,
        endpoint: `${env.STORAGE_BACKEND_PROTOCOL}://${env.STORAGE_BACKEND_HOST}:${env.STORAGE_BACKEND_PORT}`,
        region: env.STORAGE_BACKEND_S3_REGION,
        port: env.STORAGE_BACKEND_PORT,
        forcePathStyle: true,
      }
    } else {
      this.config = {
        type: StorageType.AZURE, // azure config
        connectionString: `DefaultEndpointsProtocol=${env.STORAGE_BACKEND_PROTOCOL};AccountName=${env.STORAGE_BACKEND_ACCOUNT_NAME};AccountKey=${env.STORAGE_BACKEND_ACCOUNT_SECRET};BlobEndpoint=${env.STORAGE_BACKEND_PROTOCOL}://${env.STORAGE_BACKEND_HOST}:${env.STORAGE_BACKEND_PORT}/${env.STORAGE_BACKEND_ACCOUNT_NAME}`,
      }
    }
    if (this.config === undefined) {
      throw new Error('Storage config not found')
    }
    this.storage = new Storage(this.config)
    this.logger.child({ module: 'Storage Class' })
  }

  async createBucketIfDoesNotExist() {
    this.logger.info('Creating bucket if it does not exist')
    const buckets = await this.storage.listBuckets()
    if (buckets.error !== null) {
      throw new Error('Failed to list buckets')
    }

    const bucketExists = buckets.value?.find((bucket) => bucket === this.env.STORAGE_BACKEND_BUCKET_NAME)
    if (bucketExists) {
      return
    }

    const createdBucket = await this.storage.createBucket(this.env.STORAGE_BACKEND_BUCKET_NAME)
    if (createdBucket.error !== null) {
      throw new Error('Failed to create bucket')
    }
  }

  async addFile(fileBuffer: Buffer, filename: string) {
    this.logger.info('Uploading file to bucket')
    await this.createBucketIfDoesNotExist()

    const upload = await this.storage.addFileFromBuffer({
      buffer: fileBuffer,
      targetPath: filename,
      bucketName: this.env.STORAGE_BACKEND_BUCKET_NAME,
    })
    if (upload.error !== null) {
      throw new Error('Failed to upload file')
    }
  }

  async getFile(hash: string) {
    this.logger.info('Retrieving file from bucket')

    const stream = await this.storage.getFileAsStream(this.env.STORAGE_BACKEND_BUCKET_NAME, hash)
    if (stream.error !== null) {
      throw new NotFound(`Failed to retrieve file with filename: ${hash}`)
    }

    const buffer = await this.resultObjectStreamToBuffer(stream)
    return buffer
  }

  async listBuckets() {
    this.logger.info('Listing buckets')
    const buckets = await this.storage.listBuckets()
    return buckets
  }

  // generate hash to use as a file name for S3/Azure storage
  async hashFromBuffer(buffer: Buffer, filename?: string) {
    this.logger.info('Generating hash from buffer', filename) // use the filename somehow differently
    return createHash('sha256').update(buffer).digest('hex')
  }

  async resultObjectStreamToBuffer(result: ResultObjectStream): Promise<Buffer> {
    this.logger.info('Converting result object stream to buffer')
    if (result.error) {
      throw new Error(`Stream error: ${result.error}`)
    }

    if (!result.value) {
      throw new Error('No stream found in result.value')
    }

    const stream = result.value
    const chunks: Buffer[] = []

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      stream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      stream.on('error', (err) => {
        reject(new Error(`Stream read failed: ${err.message}`))
      })
    })
  }

  getStatus = async () => {
    try {
      const buckets = await this.storage.listBuckets()
      if (buckets.error !== null) {
        logStatusError(this.logger, buckets.error)
        return {
          status: serviceState.DOWN,
          detail: { message: `Error getting status from storage ${buckets.error}` },
        }
      }
    } catch (e) {
      logStatusError(this.logger, e)
      return {
        status: serviceState.DOWN,
        detail: { message: `Error getting status from storage ${e}` },
      }
    }
    return {
      status: serviceState.UP,
      detail: { version: '1.0.0', peerCount: 0 }, // do we include this? or rewrite the status type?
    }
  }
}
const logStatusError = (logger: Logger, details: unknown) => {
  if (details instanceof Error) {
    logger.error('Error getting status from storage. Message: %s', details.message)
    logger.debug('Error getting status from storage. Stack: %j', details.stack)
  } else {
    logger.error('Error getting status from storage: %s', JSON.stringify(details))
  }
}

// Type guard functions
export function isS3Env(env: Env): env is S3Env {
  return env.STORAGE_BACKEND_MODE === 'S3'
}

export function isAzureEnv(env: Env): env is AzureEnv {
  return env.STORAGE_BACKEND_MODE === 'AZURE'
}
