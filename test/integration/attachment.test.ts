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
  mockEnvWithIpfsAsStorage,
  withIpfsMockTest,
} from '../helper/mock.js'
import {
  cleanup,
  parametersAttachmentId,
  attachmentSeed,
  parametersAttachmentId2,
  nonExistentAttachmentId,
  parametersAttachmentId4,
  attachmentSeedWithTheSameHash,
} from '../seeds/attachment.seed.js'
import supertest from 'supertest'

describe('attachment', () => {
  const size = 100
  const blobData = 'a'.repeat(size)
  const filename = 'test.pdf'
  const overSize = 115343360
  const overSizeBlobData = 'a'.repeat(overSize)
  const jsonData = { key: 'it', filename: 'JSON attachment it' }
  const dataToRetrieveByInternal = { key: 'internalData', filename: 'JSON attachment internalData' }
  const blobDataCidV0 = 'QmXrvgzuTm4YnaVGyQmNm9kef2ica6DTGUpmWg8eAVi5dV'
  const jsonDataCidV0 = 'QmcASNAZW7eWhPVJY948179VKDDJepM7dan3UXZYC2C4Ek'
  // const jsonDataInternalCidV0 = 'QmS2JWZj8kMNHZQd7qSrfJDp8n54Ump236HDU5kDCLCc5m'
  // const jsonDataInternalCidV0 = 'QmaT82csdi3PrVPcpfEaXYn6K2WpaQ8GRkwMm8Jz9nh2sb'
  const jsonDataInternalCidV0 = 'QmRY67yZ5Ff4gaCJFq8zVWQwx7L9GbCzUPC8GgoYaKyY4d'

  const jsonDataCreateInternal = {
    integrityHash: jsonDataInternalCidV0,
    ownerAddress: selfAddress,
  }

  let app: Express

  const context: MockContext = {}
  withIdentityMock(context)
  withAttachmentMock(context)
  before(async () => {
    mockEnvWithIpfsAsStorage()
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
        {
          id: parametersAttachmentId4,
          integrityHash: 'QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN',
          owner: 'other',
          filename: null,
          size: null,
          createdAt: '2021-05-07T15:48:48.774Z',
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
      expect(body).to.contain.deep.members([
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
      expect(body).to.contain.deep.members([
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
      expect(body).to.contain.deep.members([
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
      expect(body).to.contain.deep.members([
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

    it('returns 401 with external auth', async () => {
      const { status, body } = await getExternal(app, `/v1/attachment`)
      expect(status).to.equal(401)
      expect(body).to.contain({
        message: 'Forbidden',
      })
    })
  })

  describe('uploads and retrieves attachment [octet]', () => {
    let octetRes: supertest.Response

    withIpfsMock(blobData, context, blobDataCidV0)

    beforeEach(async () => {
      octetRes = await postFile(app, '/v1/attachment', Buffer.from(blobData), filename)
    })

    it('confirms JSON attachment uploads', () => {
      // assert octet

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

    withIpfsMock(jsonData, context, jsonDataCidV0)

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

  describe('uploads attachment [external]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context, jsonDataCidV0)

    beforeEach(async () => {
      jsonRes = await postExternal(app, '/v1/attachment', jsonData)
    })

    it('should fail 401', () => {
      expect(jsonRes.status).to.equal(401)
    })

    it("doesn't modify attachments", async () => {
      const { status, body } = await get(app, `/v1/attachment`)
      expect(status).to.equal(200)
      expect(body).to.deep.equal([])
    })
  })

  // this test ensures if we perform an "internal" body request but as an external part it is NOT
  // treated as an internal upload. Instead the file is uploaded as a json file
  describe('uploads and retrieves an attachment [internal body as json]', () => {
    withIpfsMockTest(dataToRetrieveByInternal, context, jsonDataInternalCidV0)

    let jsonRes: supertest.Response
    beforeEach(async () => {
      // const ipfs = new Ipfs({ host: env.IPFS_HOST, port: env.IPFS_PORT, logger })

      // const jsonString = JSON.stringify(dataToRetrieveByInternal)
      // const hash = await ipfs.cidHashFromBuffer(Buffer.from(jsonString), 'json')
      // console.log('internal new hash', hash)
      jsonRes = await postInternal(app, '/v1/attachment', jsonDataCreateInternal)
    })

    it('confirms JSON upload', () => {
      // assert JSON
      expect(jsonRes.status).to.equal(201)
      expect(jsonRes.body).to.contain.keys(['id', 'createdAt'])
      expect(jsonRes.body.integrityHash).to.equal(jsonDataInternalCidV0)
    })

    it('returns JSON attachment', async () => {
      const { id } = jsonRes.body
      const { status, body } = await get(app, `/v1/attachment/${id}`, { accept: 'application/json' })
      const json = await JSON.parse(body.toString())
      expect(status).to.equal(200)
      expect(json).to.contain(dataToRetrieveByInternal)
    })
  })

  describe('uploads and retrieves an attachment [internal]', () => {
    let jsonRes: supertest.Response

    withIpfsMockTest(dataToRetrieveByInternal, context, jsonDataInternalCidV0)

    beforeEach(async () => {
      jsonRes = await postInternal(app, '/v1/attachment', jsonDataCreateInternal)
    })

    it('returns a valid attachment response', () => {
      expect(jsonRes.status).to.equal(201)
      expect(jsonRes.body).to.contain.keys(['id', 'createdAt', 'integrityHash', 'owner', 'size', 'filename'])
      expect(jsonRes.body.filename).to.equal(null)
      expect(jsonRes.body.size).to.equal(null)
      expect(jsonRes.body.owner).to.equal('self')
      expect(jsonRes.body.integrityHash).to.equal(jsonDataInternalCidV0)
    })

    it('is included in attachment list', async () => {
      const { id } = jsonRes.body
      const { status, body } = await get(app, `/v1/attachment?id=${id}`)

      expect(status).to.equal(200)
      expect(body.length).to.equal(1)
      expect(body[0]).to.deep.equal({
        id: jsonRes.body.id,
        createdAt: jsonRes.body.createdAt,
        integrityHash: jsonDataInternalCidV0,
        owner: 'self',
        size: null,
        filename: null,
      })
    })

    it('returns JSON attachment', async () => {
      const { id } = jsonRes.body
      const { status, body } = await get(app, `/v1/attachment/${id}`, { accept: 'application/json' })
      const json = await JSON.parse(body.toString())
      expect(status).to.equal(200)
      expect(json).to.deep.contain(dataToRetrieveByInternal) // this now returns an octet stream even if it's plain json is that ok?
    })

    it('returns first attachment when fetching by hash', async () => {
      await attachmentSeedWithTheSameHash(jsonDataInternalCidV0)

      const res = await get(app, `/v1/attachment/${jsonDataInternalCidV0}`, { accept: 'application/octet-stream' })
      expect(res.status).to.equal(200)
      expect(res.header).to.deep.contain({
        'content-disposition': 'attachment; filename="JSON attachment internalData"',
      })
    })

    it('returns 404 when hash/UUID is not found', async () => {
      const { status, body } = await get(app, `/v1/attachment/nonexistenthash`)

      expect(status).to.equal(404)
      expect(body).to.equal('attachment not found')
    })
  })

  describe('upload [oauth2] then retrieves an attachment [external]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context, jsonDataCidV0)
    withAuthzMock(context)

    beforeEach(async () => {
      const response = await post(app, '/v1/attachment', jsonData)
      const hash = response.body.integrityHash

      jsonRes = await getExternal(app, `/v1/attachment/${hash}`)
    })

    it('should retrieve the file successfully', () => {
      expect(jsonRes.status).to.equal(200)
      expect(jsonRes.body).to.deep.contain(jsonData)
    })
  })

  // does this test still apply?
  describe('create [internal] then retrieves attachment (401) [external]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context, jsonDataCidV0)
    withAuthzMock(context, 401)

    beforeEach(async () => {
      const response = await postInternal(app, '/v1/attachment', jsonDataCreateInternal)
      const hash = response.body.integrityHash

      jsonRes = await getExternal(app, `/v1/attachment/${hash}`)
    })

    it('should error unauthorised', () => {
      expect(jsonRes.status).to.equal(401)
    })
  })

  describe('upload [oauth2] then retrieves unauthorized attachment (401) [external]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context, jsonDataCidV0)
    withAuthzMock(context, 401)

    beforeEach(async () => {
      const response = await post(app, '/v1/attachment', jsonData)
      const hash = response.body.integrityHash

      jsonRes = await getExternal(app, `/v1/attachment/${hash}`)
    })

    it('should error unauthorised', () => {
      expect(jsonRes.status).to.equal(401)
    })
  })

  describe('upload [oauth2] then retrieves unauthorized attachment (bad response) [external]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context, jsonDataCidV0)
    withAuthzMock(context, 200, {})

    beforeEach(async () => {
      const response = await post(app, '/v1/attachment', jsonData)
      const hash = response.body.integrityHash

      jsonRes = await getExternal(app, `/v1/attachment/${hash}`)
    })

    it('should error unauthorised', () => {
      expect(jsonRes.status).to.equal(401)
    })
  })

  describe('upload [oauth2] then retrieves unauthorized attachment (allow: false) [external]', () => {
    let jsonRes: supertest.Response

    withIpfsMock(jsonData, context, jsonDataCidV0)
    withAuthzMock(context, 200, { result: { allow: false } })

    beforeEach(async () => {
      const response = await post(app, '/v1/attachment', jsonData)
      const hash = response.body.integrityHash

      jsonRes = await getExternal(app, `/v1/attachment/${hash}`)
    })

    it('should error unauthorised', () => {
      expect(jsonRes.status).to.equal(401)
    })
  })

  describe('delete attachment [internal]', () => {
    let jsonRes: supertest.Response

    beforeEach(async () => {
      await attachmentSeed()
      jsonRes = await delInternal(app, `/v1/attachment/${parametersAttachmentId}`)
    })

    it('should succeed 204', () => {
      expect(jsonRes.status).to.equal(204)
    })

    it('removes attachment from list', async () => {
      const { status, body } = await get(app, `/v1/attachment`)
      expect(status).to.equal(200)
      expect(body).to.contain.deep.members([
        {
          createdAt: '2022-01-01T00:00:00.000Z',
          filename: 'test2.txt',
          id: parametersAttachmentId2,
          integrityHash: 'hash2',
          owner: 'other',
          size: 42,
        },
        {
          createdAt: '2021-05-07T15:48:48.774Z',
          filename: null,
          id: parametersAttachmentId4,
          integrityHash: 'QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN',
          owner: 'other',
          size: null,
        },
      ])
    })
  })

  describe('delete non-existant attachment [internal]', () => {
    let jsonRes: supertest.Response

    beforeEach(async () => {
      await attachmentSeed()
      jsonRes = await delInternal(app, `/v1/attachment/bad9ad47-91c3-446e-90f9-a7c9b233ebad`)
    })

    it('should fail 404', () => {
      expect(jsonRes.status).to.equal(404)
    })

    it("doesn't modify attachments", async () => {
      const { status, body } = await get(app, `/v1/attachment`)
      expect(status).to.equal(200)
      expect(body).to.contain.deep.members([
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
        {
          createdAt: '2021-05-07T15:48:48.774Z',
          filename: null,
          id: parametersAttachmentId4,
          integrityHash: 'QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN',
          owner: 'other',
          size: null,
        },
      ])
    })
  })

  describe('delete attachment [oauth2]', () => {
    let jsonRes: supertest.Response

    beforeEach(async () => {
      await attachmentSeed()
      jsonRes = await del(app, `/v1/attachment/${parametersAttachmentId}`)
    })

    it('should fail 401', () => {
      expect(jsonRes.status).to.equal(401)
    })

    it("doesn't modify attachments", async () => {
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
        {
          createdAt: '2021-05-07T15:48:48.774Z',
          filename: null,
          id: parametersAttachmentId4,
          integrityHash: 'QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN',
          owner: 'other',
          size: null,
        },
      ])
    })
  })

  describe('delete attachment [external]', () => {
    let jsonRes: supertest.Response

    beforeEach(async () => {
      await attachmentSeed()
      jsonRes = await delExternal(app, `/v1/attachment/${parametersAttachmentId}`)
    })

    it('should fail 401', () => {
      expect(jsonRes.status).to.equal(401)
    })

    it("doesn't modify attachments", async () => {
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
        {
          createdAt: '2021-05-07T15:48:48.774Z',
          filename: null,
          id: parametersAttachmentId4,
          integrityHash: 'QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN',
          owner: 'other',
          size: null,
        },
      ])
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
      const { status } = await get(app, `/v1/attachment/${uploadRes.body.id}`)

      expect(status).to.equal(404)
    })

    it('returns 400 with invalid internal create', async () => {
      const { status, body } = await postInternal(app, '/v1/attachment', { integrityHash: 'hash1' }) // missing ownerAddress

      expect(status).to.equal(400)
      expect(body).to.equal('Invalid body for internal attachment creation')
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

  describe('getById - retrieving attachment not owned by us ', () => {
    beforeEach(async () => {
      await attachmentSeed()
    })
    withIpfsMock(blobData, context, blobDataCidV0)
    withAuthzMock(context, 200, { result: { allow: true } })

    it('should retrieve attachment not owned by us  as application/json', async () => {
      const { status, body } = await get(app, `/v1/attachment/${parametersAttachmentId4}`, {
        accept: 'application/json',
      })
      expect(status).to.equal(200)
      expect(body).to.contain({ key: 'it', filename: 'JSON attachment it' })
    })

    it('should retrieve attachment not owned by us as octet-stream', async () => {
      const { status, body, header } = await get(app, `/v1/attachment/${parametersAttachmentId4}`, {
        accept: 'application/octet-stream',
      })
      expect(status).to.equal(200)
      expect(body).to.be.an.instanceOf(Buffer)
      expect(header).to.deep.contain({
        'content-type': 'application/octet-stream',
        'content-disposition': 'attachment; filename="json"',
      })
    })

    it('should handle error when peer attachment retrieval fails', async () => {
      withIpfsMockError(context)
      const { status, body } = await get(app, `/v1/attachment/${nonExistentAttachmentId}`, {
        accept: 'application/json',
      })
      expect(status).to.equal(404)
      expect(body).to.equal('attachment not found')
    })

    it('should update attachment metadata after successful retrieval', async () => {
      const { status, body } = await get(app, `/v1/attachment/${parametersAttachmentId4}`, {
        accept: 'application/json',
      })
      expect(status).to.equal(200)
      expect(body).to.contain({ key: 'it', filename: 'JSON attachment it' })

      // Verify the attachment was updated in the database
      const { status: listStatus, body: attachments } = await get(app, `/v1/attachment?id=${parametersAttachmentId4}`)
      expect(listStatus).to.equal(200)
      expect(attachments[0]).to.have.property('filename')
      expect(attachments[0].filename).to.not.equal(null)
    })
  })
})
