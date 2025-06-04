import { type Logger } from 'pino'
import { inject, singleton } from 'tsyringe'
import { LoggerToken } from '../logger.js'
import { StorageType, Storage } from '@tweedegolf/storage-abstraction'
import { type Env, EnvToken } from '../../env.js'
import { ResultObjectStream } from '@tweedegolf/storage-abstraction/dist/types/result.js'
import { NotFound } from '../error-handler/index.js'
import { createHash } from 'crypto'

@singleton()
export default class StorageClass {
  private storage: Storage
  private config
  constructor(
    @inject(EnvToken) private env: Env,
    @inject(LoggerToken) private logger: Logger
  ) {
    this.config =
      env.STORAGE_BACKEND_MODE === 's3' || env.STORAGE_BACKEND_MODE === 'minio'
        ? {
            type: StorageType.S3, // localstack and minio config
            accessKeyId: env.STORAGE_ACCESS_KEY,
            secretAccessKey: env.STORAGE_SECRET_KEY,
            endpoint: `${env.STORAGE_PROTOCOL}://${env.S3_HOST}:${env.S3_PORT}`,
            region: env.S3_REGION,
            port: env.S3_PORT,
            forcePathStyle: true,
          }
        : {
            type: StorageType.AZURE, // azure config
            connectionString: `DefaultEndpointsProtocol=${env.STORAGE_PROTOCOL};AccountName=${env.STORAGE_ACCESS_KEY};AccountKey=${env.STORAGE_SECRET_KEY};BlobEndpoint=${env.STORAGE_PROTOCOL}://${env.AZURE_HOST}:${env.AZURE_PORT}/${env.STORAGE_ACCESS_KEY}`,
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
    const bucketExists = buckets.value?.find((bucket) => bucket === this.env.STORAGE_BUCKET_NAME)
    if (bucketExists) {
      return
    }
    const createdBucket = await this.storage.createBucket(this.env.STORAGE_BUCKET_NAME)
    if (createdBucket.error !== null) {
      throw new Error('Failed to create bucket')
    }
  }

  async uploadFile(fileBuffer: Buffer, filename: string) {
    this.logger.info('Uploading file to bucket')
    await this.createBucketIfDoesNotExist()

    const upload = await this.storage.addFileFromBuffer({
      buffer: fileBuffer,
      targetPath: filename,
      bucketName: this.env.STORAGE_BUCKET_NAME,
    })
    if (upload.error !== null) {
      throw new Error('Failed to upload file')
    }
  }

  async retrieveFileBuffer(filename: string) {
    this.logger.info('Retrieving file from bucket')
    const stream = await this.storage.getFileAsStream(this.env.STORAGE_BUCKET_NAME, filename)
    if (stream.error !== null) {
      throw new NotFound(`Failed to retrieve file with filename: ${filename}`)
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
  async hashFromBuffer(buffer: Buffer) {
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
}
