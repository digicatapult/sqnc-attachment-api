import { describe, before } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'

import createHttpServer from '../../src/server.js'
import { get, post, postFile } from '../helper/routeHelper.js'

import { withIpfsMockError, withIpfsMock, MockContext, withIdentityMock } from '../helper/mock.js'
import { cleanup, parametersAttachmentId, attachmentSeed, parametersAttachmentId2 } from '../seeds/attachment.seed.js'
import supertest from 'supertest'

describe('attachment', () => {
  const size = 100
  const blobData = 'a'.repeat(size)
  const filename = 'test.pdf'
  const overSize = 115343360
  const overSizeBlobData = 'a'.repeat(overSize)
  const jsonData = { key: 'it', filename: 'JSON attachment it' }
  let app: Express

  const context: MockContext = {}
  withIdentityMock(context)

  before(async () => {
    app = await createHttpServer()
  })

  afterEach(async () => {
    await cleanup()
  })

  describe('invalid requests', () => {
    it('returns 422 when attempting to retrieve by not UUID', async () => {
      const { status, body } = await get(app, '/v1/attachment/not-uuid')

      expect(status).to.equal(422)
      expect(body).to.have.keys(['fields', 'message', 'name'])
      expect(body).to.contain({
        name: 'ValidateError',
        message: 'Validation failed',
      })
    })

    it('returns 404 if no records found', async () => {
      const { status, body } = await get(app, '/v1/attachment/afe7e60a-2fd8-43f9-9867-041f14e3e8f4')

      expect(status).to.equal(404)
      expect(body).to.equal('attachment not found')
    })

    it('returns 422 with invalid updatedSince date', async () => {
      const { status, body } = await get(app, `/v1/attachment?updated_since=foo`)
      expect(status).to.equal(422)
      expect(body).to.contain({
        name: 'ValidateError',
        message: 'Validation failed',
      })
    })

    it('returns 401 with invalid token', async () => {
      const { status, body } = await get(app, `/v1/attachment/${parametersAttachmentId}`, {
        authorization: 'bearer invalid',
      })
      expect(status).to.equal(401)
      expect(body).to.contain({
        message: 'Forbidden',
      })
    })
  })

  describe('list attachments', () => {
    beforeEach(async () => await attachmentSeed())

    it('returns attachments', async () => {
      const { status, body } = await get(app, `/v1/attachment`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: parametersAttachmentId,
          integrityHash: 'hash1',
          owner: 'self',
          size: 42,
        },
        {
          createdAt: '2022-01-01T00:00:00.000Z',
          filename: 'test2.txt',
          id: parametersAttachmentId2,
          integrityHash: 'hash2',
          owner: 'other',
          size: 42,
        },
      ])
    })

    it('filters all attachments based on created date', async () => {
      const { status, body } = await get(app, `/v1/attachment?updated_since=2023-01-01T00:00:00.000Z`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([])
    })

    it('filters some attachments based on created date', async () => {
      const { status, body } = await get(app, `/v1/attachment?updated_since=2022-01-01T00:00:00.000Z`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: 'a789ad47-91c3-446e-90f9-a7c9b233eaf8',
          integrityHash: 'hash1',
          owner: 'self',
          size: 42,
        },
      ])
    })

    it('filters attachment by owner (self by alias)', async () => {
      const { status, body } = await get(app, `/v1/attachment?owner=self`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: parametersAttachmentId,
          integrityHash: 'hash1',
          owner: 'self',
          size: 42,
        },
      ])
    })

    it('filters attachment by owner (self by address)', async () => {
      const { status, body } = await get(app, `/v1/attachment?owner=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: parametersAttachmentId,
          integrityHash: 'hash1',
          owner: 'self',
          size: 42,
        },
      ])
    })

    it('filters attachment by owner (other by alias)', async () => {
      const { status, body } = await get(app, `/v1/attachment?owner=other`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2022-01-01T00:00:00.000Z',
          filename: 'test2.txt',
          id: parametersAttachmentId2,
          integrityHash: 'hash2',
          owner: 'other',
          size: 42,
        },
      ])
    })

    it('filters attachment by owner (other by address)', async () => {
      const { status, body } = await get(app, `/v1/attachment?owner=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2022-01-01T00:00:00.000Z',
          filename: 'test2.txt',
          id: parametersAttachmentId2,
          integrityHash: 'hash2',
          owner: 'other',
          size: 42,
        },
      ])
    })

    it('filters attachment by integrity hash', async () => {
      const { status, body } = await get(app, `/v1/attachment?integrityHash=hash2`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2022-01-01T00:00:00.000Z',
          filename: 'test2.txt',
          id: parametersAttachmentId2,
          integrityHash: 'hash2',
          owner: 'other',
          size: 42,
        },
      ])
    })

    it('filters single attachment by id', async () => {
      const { status, body } = await get(app, `/v1/attachment?id=${parametersAttachmentId}`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: parametersAttachmentId,
          integrityHash: 'hash1',
          owner: 'self',
          size: 42,
        },
      ])
    })

    it('filters multiple attachments by id', async () => {
      const { status, body } = await get(
        app,
        `/v1/attachment?id=${parametersAttachmentId}&id=${parametersAttachmentId2}`
      )
      expect(status).to.equal(200)
      expect(body).to.deep.equal([
        {
          createdAt: '2023-01-01T00:00:00.000Z',
          filename: 'test.txt',
          id: parametersAttachmentId,
          integrityHash: 'hash1',
          owner: 'self',
          size: 42,
        },
        {
          createdAt: '2022-01-01T00:00:00.000Z',
          filename: 'test2.txt',
          id: parametersAttachmentId2,
          integrityHash: 'hash2',
          owner: 'other',
          size: 42,
        },
      ])
    })

    it('returns 401 with invalid token', async () => {
      const { status, body } = await get(app, `/v1/attachment`, {
        authorization: 'bearer invalid',
      })
      expect(status).to.equal(401)
      expect(body).to.contain({
        message: 'Forbidden',
      })
    })
  })

  describe('uploads and retrieves attachment [octet]', () => {
    let octetRes: supertest.Response

    withIpfsMock(blobData, context)

    beforeEach(async () => {
      octetRes = await postFile(app, '/v1/attachment', Buffer.from(blobData), filename)
    })

    it('confirms JSON attachment uploads', () => {
      // assert octect

      expect(octetRes.status).to.equal(201)
      expect(octetRes.body).to.have.property('id')
      expect(octetRes.body.filename).to.equal(filename)
      expect(octetRes.body.size).to.equal(size)
    })

    it('returns octet attachment', async () => {
      const { id } = octetRes.body
      const { status, body, header } = await get(app, `/v1/attachment/${id}`, { accept: 'application/octet-stream' })

      expect(status).to.equal(200)
      expect(Buffer.from(body).toString()).to.equal(blobData)
      expect(header).to.deep.contain({
        immutable: 'true',
        maxage: '31536000000',
        'content-type': 'application/octet-stream',
        'access-control-expose-headers': 'content-disposition',
        'content-disposition': 'attachment; filename="test.pdf"',
      })
    })

    it('returns octet when JSON.parse fails', async () => {
      const { id } = octetRes.body
      const { status, body, header } = await get(app, `/v1/attachment/${id}`, { accept: 'application/json' })

      expect(status).to.equal(200)
      expect(Buffer.from(body).toString()).to.equal(blobData)
      expect(header).to.deep.contain({
        immutable: 'true',
        maxage: '31536000000',
        'content-type': 'application/octet-stream',
        'access-control-expose-headers': 'content-disposition',
        'content-disposition': 'attachment; filename="test.pdf"',
      })
    })
  })

  describe('uploads and retrieves attachment [json]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context)

    beforeEach(async () => {
      jsonRes = await post(app, '/v1/attachment', jsonData)
    })

    it('confirms JSON and octet attachment uploads', () => {
      // assert JSON
      expect(jsonRes.status).to.equal(201)
      expect(jsonRes.body).to.contain.keys(['id', 'createdAt'])
      expect(jsonRes.body.filename).to.equal('json')
    })

    it('returns JSON attachment', async () => {
      const { id } = jsonRes.body
      const { status, body } = await get(app, `/v1/attachment/${id}`, { accept: 'application/json' })

      expect(status).to.equal(200)
      expect(body).to.contain(jsonData)
    })

    it('attachment as octet with the filename [json]', async () => {
      const { status, body, header } = await get(app, `/v1/attachment/${jsonRes.body.id}`, {
        accept: 'application/octet-stream',
      })

      expect(status).to.equal(200)
      expect(Buffer.from(body).toString()).to.equal('{"key":"it","filename":"JSON attachment it"}')
      expect(header).to.deep.contain({
        immutable: 'true',
        maxage: '31536000000',
        'content-type': 'application/octet-stream',
        'access-control-expose-headers': 'content-disposition',
        'content-disposition': 'attachment; filename="json"',
      })
    })
  })

  describe('uploads errors', () => {
    it('returns 401 with invalid token', async () => {
      const { status, body } = await postFile(app, '/v1/attachment', Buffer.from(blobData), filename, {
        authorization: 'bearer invalid',
      })

      expect(status).to.equal(401)
      expect(body).to.contain({
        message: 'Forbidden',
      })
    })

    it('Doesn`t upload files if more than 100mb', async () => {
      const uploadRes = await postFile(app, '/v1/attachment', Buffer.from(overSizeBlobData), 'json')
      const { status, body } = await get(app, `/v1/attachment/${uploadRes.body.id}`)

      expect(status).to.equal(422)
      expect(body.toString()).to.deep.contain({ message: 'Validation failed' })
    })
  })

  describe('IPFS errors', function () {
    withIpfsMockError(context)

    it('ipfs error - 500', async () => {
      const { status, body } = await post(app, '/v1/attachment', jsonData)
      expect(status).to.equal(500)
      expect(body).to.equal('error')
    })
  })
})
