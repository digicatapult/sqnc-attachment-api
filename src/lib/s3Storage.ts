import { type Logger } from 'pino'
import { inject, singleton } from 'tsyringe'
import { LoggerToken } from './logger.js'
import { StorageType, Storage } from '@tweedegolf/storage-abstraction'
import all from 'it-all'
import { type Env, EnvToken } from '../env.js'
import { importer } from 'ipfs-unixfs-importer'
import { MemoryBlockstore } from 'blockstore-core'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { UnixFS } from 'ipfs-unixfs'
import { encode as encodeBlock } from '@ipld/dag-pb'
import * as raw from 'multiformats/hashes/sha2'
import { CID } from 'multiformats/cid'

@singleton()
export default class S3Storage {
  private storageType: StorageType.S3 | StorageType.AZURE
  private storage: Storage
  private config
  constructor(
    @inject(EnvToken) private env: Env,
    @inject(LoggerToken) private logger: Logger
  ) {
    this.storageType = env.STORAGE_TYPE === 's3' ? StorageType.S3 : StorageType.AZURE
    this.config =
      env.STORAGE_TYPE === 's3'
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
    await this.createBucketIfDoesNotExist()

    const upload = await this.storage.addFileFromBuffer({
      buffer: fileBuffer,
      targetPath: filename,
      bucketName: this.env.STORAGE_BUCKET_NAME,
    })
    if (upload.error !== null) {
      throw new Error('Failed to upload file')
    }
    await this.listBuckets()
  }

  async retrieveFileBuffer(filename: string) {
    const file = await this.storage.getFileAsStream(this.env.STORAGE_BUCKET_NAME, filename)
    if (file.error !== null) {
      throw new Error('Failed to retrieve file')
    }
    return file.value
  }

  async listBuckets() {
    // const makeBucket = await this.storage.createBucket('test')
    // console.log(makeBucket)
    const buckets = await this.storage.listBuckets()
    // console.log(buckets)

    // const upload = await this.storage.addFileFromPath({
    //   bucketName: 'test',
    //   origPath: '/Users/hadamkova/eng/sqnc-attachment-api/testFiles/stuff.pdf',
    //   targetPath: 'stuff',
    // })
    // console.log(upload)
    const filesInBucket = await this.storage.listFiles(this.env.STORAGE_BUCKET_NAME)
    console.log(filesInBucket)
    // const file = await this.storage.getFileAsURL('test', 'stuff')
    // console.log(file)
    // const actualFile = await this.storage.getFileAsStream('test', 'stuff')
    // const readableStream = new Stream.Readable()
    // const writableStream = createWriteStream('test1.md')
    // actualFile.value?.pipe(writableStream)

    // console.log('File saved successfully.')
  }

  async hashFromBuffer(buffer: Buffer) {
    // unused rn, produces same hash as below method
    const file = {
      content: buffer,
      path: '',
    }
    const blockstore = new MemoryBlockstore()

    const entries = await all(
      importer([file], blockstore, {
        cidVersion: 0,
        rawLeaves: false,
        chunker: fixedSize({ chunkSize: 262144 }), // 256 KB chunks
      })
    )
    const root = entries.at(-1)
    if (!root) {
      throw new Error('No root found')
    }
    console.log('CID:', root.cid.toString())
    return root.cid.toString()
  }

  async generateCIDv0LikeIpfs(content: Buffer) {
    // Wrap content in UnixFS "file" node
    const unixFs = new UnixFS({ type: 'file', data: content })
    const pbNode = {
      Data: unixFs.marshal(),
      Links: [],
    }

    // Encode DAG-PB block
    const encoded = encodeBlock(pbNode)

    // Hash with sha2-256
    const hash = await raw.sha256.digest(encoded)

    // Create CIDv0
    const cid = CID.createV0(hash)
    return cid.toString()
  }
}
