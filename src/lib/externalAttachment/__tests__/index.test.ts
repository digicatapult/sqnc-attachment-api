import { describe, it } from 'mocha'
import { container } from 'tsyringe'
import { ExternalAttachmentService } from '../index.js'

import { expect } from 'chai'
import sinon from 'sinon'
import { type MockContext, withAuthzMock, withIdentityMock } from '../../../../test/helper/mock.js'

describe('ExternalAttachmentService', () => {
  const context: MockContext = {}
  withIdentityMock(context)
  withAuthzMock(context)

  describe('getOidcConfig', () => {
    let service: ExternalAttachmentService
    let fetchStub: sinon.SinonStub

    beforeEach(() => {
      service = container.resolve(ExternalAttachmentService)
      fetchStub = sinon.stub(global, 'fetch')
    })

    afterEach(() => {
      fetchStub.restore()
    })

    it('should successfully fetch OIDC configuration', async () => {
      const mockOidcConfig = {
        token_endpoint: 'https://example.com/token',
      }

      fetchStub.resolves({
        ok: true,
        json: () => Promise.resolve(mockOidcConfig),
      })

      const result = await service.getOidcConfig('https://example.com/external/.well-known/openid-configuration')

      expect(fetchStub.calledWith('https://example.com/external/.well-known/openid-configuration')).to.be.equal(true)
      expect(result).to.deep.equal(mockOidcConfig)
    })

    it('should throw error when OIDC configuration fetch fails', async () => {
      fetchStub.resolves({
        ok: false,
        status: 404,
      })

      try {
        await service.getOidcConfig('https://example.com')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.equal('Failed to fetch OIDC configuration')
      }
    })
  })

  describe('getAccessToken', () => {
    let service: ExternalAttachmentService
    let fetchStub: sinon.SinonStub

    beforeEach(() => {
      service = container.resolve(ExternalAttachmentService)
      fetchStub = sinon.stub(global, 'fetch')
    })

    afterEach(() => {
      fetchStub.restore()
    })

    it('should successfully obtain access token', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }

      fetchStub.resolves({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })

      const result = await service.getAccessToken('https://example.com/token', 'test-client-id', 'test-client-secret')

      expect(
        fetchStub.calledWith('https://example.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
          }),
        })
      ).to.be.equal(true)

      expect(result).to.equal('mock-access-token')
    })

    it('should throw error when token request fails', async () => {
      fetchStub.resolves({
        ok: false,
        status: 401,
      })

      try {
        await service.getAccessToken('https://example.com/token', 'test-client-id', 'test-client-secret')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.equal('Failed to obtain access token')
      }
    })
  })

  describe('fetchAttachment', () => {
    let service: ExternalAttachmentService
    let fetchStub: sinon.SinonStub
    let logStub: sinon.SinonStub

    beforeEach(() => {
      service = container.resolve(ExternalAttachmentService)
      fetchStub = sinon.stub(global, 'fetch')
      logStub = sinon.stub(service['log'], 'error')
    })

    afterEach(() => {
      fetchStub.restore()
      logStub.restore()
    })

    it('should successfully fetch attachment data', async () => {
      const mockAttachmentData = new Uint8Array([1, 2, 3, 4, 5])

      fetchStub.resolves({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAttachmentData.buffer),
        headers: new Headers({
          'content-disposition': 'attachment; filename="test.txt"',
        }),
      })

      const result = await service.fetchAttachment('https://example.com/attachment/123', 'test-access-token')

      expect(
        fetchStub.calledWith('https://example.com/attachment/123', {
          headers: {
            Authorization: 'Bearer test-access-token',
            Accept: 'application/octet-stream',
          },
        })
      ).to.be.equal(true)

      expect(result.blobBuffer).to.be.instanceof(Buffer)
      expect(result.blobBuffer).to.deep.equal(Buffer.from(mockAttachmentData))
      expect(result.filename).to.equal('test.txt')
    })

    it('should throw error and log when attachment fetch fails', async () => {
      fetchStub.resolves({
        ok: false,
        status: 404,
        headers: new Headers({
          'content-disposition': 'attachment; filename="test.txt"',
        }),
      })

      try {
        await service.fetchAttachment('https://example.com/attachment/123', 'test-access-token')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.equal('Failed to fetch attachment')
        expect(logStub.calledWith('Error fetching attachment: %s', 'Failed to fetch attachment')).to.be.equal(true)
      }
    })

    it('should handle and log network errors', async () => {
      const networkError = new Error('Network error')
      fetchStub.rejects(networkError)

      try {
        await service.fetchAttachment('https://example.com/attachment/123', 'test-access-token')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.equal(networkError)
        expect(logStub.calledWith('Error fetching attachment: %s', 'Network error')).to.be.equal(true)
      }
    })
  })
})
