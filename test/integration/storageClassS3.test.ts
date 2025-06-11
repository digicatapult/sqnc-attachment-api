import { describe, before } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import createHttpServer from '../../src/server.js'
import { get, postFile } from '../helper/routeHelper.js'
import { MockContext, withIdentityMock, withAttachmentMock, mockEnvWithS3AsStorage } from '../helper/mock.js'
import {
  cleanup,
  parametersAttachmentId,
  attachmentSeed,
  nonExistentAttachmentId,
  attachmentSeedWithIncorrectHash,
} from '../seeds/attachment.seed.js'
import StorageClass from '../../src/lib/storageClass/index.js'
import { logger } from '../../src/lib/logger.js'
import { type Env, EnvToken } from '../../src/env.js'
import { container } from 'tsyringe'

// need to change/re-register an env for the storage class - think we did this in matchmaker api

describe('attachment From S3', () => {
  const size = 100
  const blobData = 'a'.repeat(size)
  const filename = 'test.pdf'
  let hash: string | null = null
  let app: Express

  const context: MockContext = {}
  withIdentityMock(context)
  withAttachmentMock(context)
  before(async () => {
    mockEnvWithS3AsStorage()
    app = await createHttpServer()
  })

  after(async () => {
    await cleanup()
  })

  describe('test S3 storage', () => {
    it('post an attachment to S3 storage', async () => {
      const { status, body } = await postFile(app, `/v1/attachment`, Buffer.from(blobData), filename)
      expect(status).to.equal(201)
      expect(body).to.contain({
        filename: 'test.pdf',
        owner: 'self',
        size: 100,
      })
      hash = body.integrityHash
    })

    it('get an attachment from S3 storage', async () => {
      const { status, body } = await get(app, `/v1/attachment/${hash}`)
      expect(status).to.equal(200)
      expect(body).to.be.an.instanceOf(Buffer)
    })
    it('get non-existent attachment from S3 storage', async () => {
      const { status, body } = await get(app, `/v1/attachment/${nonExistentAttachmentId}`)
      expect(status).to.equal(404)
      expect(body).to.contain('attachment not found')
    })
  })
  describe('test S3 storage with seeds', () => {
    beforeEach(async () => {
      await attachmentSeed()
    })
    afterEach(async () => {
      await cleanup()
    })
    it('get attachment which exists in local db but not in Azurite storage', async () => {
      const { status, body } = await get(app, `/v1/attachment/${parametersAttachmentId}`)
      expect(status).to.equal(404)
      expect(body).to.contain('Failed to retrieve file with filename: hash1 not found')
    })
  })
  describe('S3 retrieve file with the wrong hash should fail integrity check', () => {
    const wrongHash: string = 'wrongHash'
    beforeEach(async () => {
      const env = container.resolve<Env>(EnvToken) // resolve test env
      const storage = new StorageClass(env, logger)
      await storage.uploadFile(Buffer.from(blobData), wrongHash)

      await attachmentSeedWithIncorrectHash()
    })
    afterEach(async () => {
      await cleanup()
    })
    it('try to retrieve file with the wrong hash - should fail integrity check', async () => {
      const { status, body } = await get(app, `/v1/attachment/${wrongHash}`)
      expect(status).to.equal(400)
      expect(body).to.contain('File integrity check failed')
    })
  })
})
