import { describe, before } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import createHttpServer from '../../src/server.js'
import { get, postFile } from '../helper/routeHelper.js'

import {
  MockContext,
  withIdentityMock,
  selfAddress,
  withAttachmentMock,
  mockEnvWithAzuriteAsStorage,
} from '../helper/mock.js'
import { cleanup, parametersAttachmentId, attachmentSeed, nonExistentAttachmentId } from '../seeds/attachment.seed.js'
// need to change/ re-register an env for the storage class - think we did this in matchmaker api

describe('attachment From Azurite', () => {
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
    mockEnvWithAzuriteAsStorage()
    app = await createHttpServer()
  })

  after(async () => {
    await cleanup()
  })

  describe.only('test Azurite storage', () => {
    // beforeEach(async () => await attachmentSeed())

    it('post an attachment to S3 storage', async () => {
      const { status, body } = await postFile(app, `/v1/attachment`, Buffer.from(blobData), filename)
      console.log(body)
      expect(status).to.equal(201)
      expect(body).to.contain({
        filename: 'test.pdf',
        owner: 'self',
        size: 100,
      })
      hash = body.integrityHash
    })

    it('get an attachment from Azurite storage', async () => {
      const { status, body } = await get(app, `/v1/attachment/${hash}`)
      expect(status).to.equal(200)
      expect(body).to.be.an.instanceOf(Buffer)
    })
    it('get non-existent attachment from Azurite storage', async () => {
      const { status, body } = await get(app, `/v1/attachment/${nonExistentAttachmentId}`)
      expect(status).to.equal(404)
      expect(body).to.contain('attachment not found')
    })
  })
  describe('test Azurite storage with seeds', () => {
    beforeEach(async () => {
      await attachmentSeed()
    })
    it('get attachment which exists in local db but not in Azurite storage', async () => {
      const { status, body } = await get(app, `/v1/attachment/${parametersAttachmentId}`)
      expect(status).to.equal(404)
    })
  })
})
