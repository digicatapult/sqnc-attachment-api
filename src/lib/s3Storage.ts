import { type Logger } from 'pino'
import { inject, singleton } from 'tsyringe'
import { LoggerToken } from './logger.js'
import { StorageType, Storage } from '@tweedegolf/storage-abstraction'
import { createWriteStream } from 'fs'
import Stream from 'node:stream'

@singleton()
export default class S3Storage {
  private storageType: StorageType.MINIO | StorageType.S3 | StorageType.AZURE
  private storage: Storage
  private config
  constructor(@inject(LoggerToken) private logger: Logger) {
    this.storageType = StorageType.S3
    // this.config = {
    //   type: StorageType.MINIO,
    //   port: 9000,
    //   useSSL: false,
    //   region: 'us-east-1',
    //   endPoint: 'localhost',
    //   accessKey: 'bUSVDwGm5KsvrOAJ5keT',
    //   secretKey: 'MuFMyporttNkz6m94RcCQuMkMTChvAM4fkc71xC4',
    // }

    this.config = {
      type: StorageType.S3,
      accessKeyId: 'bUSVDwGm5KsvrOAJ5keT',
      secretAccessKey: 'MuFMyporttNkz6m94RcCQuMkMTChvAM4fkc71xC4',
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      port: 9000,
      forcePathStyle: true,
    }

    // this.config = {
    //   type: StorageType.S3,
    //   accessKeyId: 'test',
    //   secretAccessKey: 'test',
    //   endpoint: 'http://localhost:4566',
    //   region: 'us-east-1',
    //   port: 4566,
    //   forcePathStyle: true,
    // }
    // this.config = {
    //   type: StorageType.AZURE,
    //   connectionString:
    //     'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;',
    // }
    this.storage = new Storage(this.config)
    this.logger.child({ module: 'minio' })
  }

  async listBuckets() {
    // const makeBucket = await this.storage.createBucket('test')
    // console.log(makeBucket)
    const buckets = await this.storage.listBuckets()
    console.log(buckets)

    const upload = await this.storage.addFileFromPath({
      bucketName: 'test',
      origPath: '/Users/hadamkova/eng/sqnc-attachment-api/testFiles/pic.png',
      targetPath: 'stuff',
    })
    console.log(upload)
    const filesInBucket = await this.storage.listFiles('test')
    console.log(filesInBucket)
    const file = await this.storage.getFileAsURL('test', 'stuff')
    console.log(file)
    const actualFile = await this.storage.getFileAsStream('test', 'stuff')
    // const readableStream = new Stream.Readable()
    const writableStream = createWriteStream('test1.png')
    actualFile.value?.pipe(writableStream)

    console.log('File saved successfully.')
  }
}
