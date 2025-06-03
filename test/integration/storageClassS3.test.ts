import { describe, before } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import createHttpServer from '../../src/server.js'
import {
  del,
  delExternal,
  delInternal,
  get,
  getExternal,
  post,
  postExternal,
  postFile,
  postInternal,
} from '../helper/routeHelper.js'

import {
  withIpfsMockError,
  withIpfsMock,
  MockContext,
  withIdentityMock,
  withAuthzMock,
  selfAddress,
  withAttachmentMock,
  mockEnvWithS3AsStorage,
} from '../helper/mock.js'
import {
  cleanup,
  parametersAttachmentId,
  attachmentSeed,
  parametersAttachmentId2,
  additionalAttachmentSeed,
  nonExistentAttachmentId,
  parametersAttachmentId4,
} from '../seeds/attachment.seed.js'
import supertest from 'supertest'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

// need to change/ re-register an env for the storage class - think we did this in matchmaker api

describe('attachment From S3', () => {
  const size = 100
  const blobData = 'a'.repeat(size)
  const filename = 'test.pdf'
  const overSize = 115343360
  let hash: string | null = null
  const overSizeBlobData = 'a'.repeat(overSize)
  const jsonData = { key: 'it', filename: 'JSON attachment it' }
  const jsonDataInternal = { integrityHash: 'hash1', ownerAddress: selfAddress }
  let app: Express

  const context: MockContext = {}
  withIdentityMock(context)
  withAttachmentMock(context)
  before(async () => {
    mockEnvWithS3AsStorage()
    app = await createHttpServer()
  })

  afterEach(async () => {
    // await cleanup()
  })

  describe('test S3 storage', () => {
    // beforeEach(async () => await attachmentSeed())

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
    it('get attachment which exists in local db but not in Azurite storage', async () => {
      await attachmentSeed()
      const { status, body } = await get(app, `/v1/attachment/${parametersAttachmentId}`)
      expect(status).to.equal(404)
    })
  })
})
