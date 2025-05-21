import { describe, it } from 'mocha'
import { Credentials } from '../index.js'
import { expect } from 'chai'
import sinon from 'sinon'

describe('Credentials', () => {
  let service: Credentials

  beforeEach(() => {
    service = new Credentials() // make sure we are using a new instance each time as we only load credentials once
  })

  describe('with real credentials file', () => {
    it('should successfully retrieve credentials for a valid owner', async () => {
      const result = await service.getCredentialsForOwner('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')

      expect(result).to.deep.equal({
        clientId: 'alice',
        clientSecret: 'secret',
      })
    })

    it('should throw error for non-existent owner', async () => {
      try {
        await service.getCredentialsForOwner('non-existent-owner')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.equal('No external credentials found for ownerId: non-existent-owner')
      }
    })
  })

  describe('with mocked file and path', () => {
    let getCredentialsPathStub: sinon.SinonStub
    let readCredentialsFileStub: sinon.SinonStub

    beforeEach(() => {
      getCredentialsPathStub = sinon.stub(service, 'getCredentialsPath')
      readCredentialsFileStub = sinon.stub(service, 'readCredentialsFile')
    })

    afterEach(() => {
      getCredentialsPathStub.restore()
      readCredentialsFileStub.restore()
    })

    it('should load credentials into map and retrieve them', async () => {
      const mockCredentials = {
        credentials: [
          {
            username: 'test-client',
            secret: 'test-secret',
            owner: 'test-owner',
          },
          {
            username: 'another-client',
            secret: 'another-secret',
            owner: 'another-owner',
          },
        ],
      }

      getCredentialsPathStub.returns('/mock/path/to/credentials.json')
      readCredentialsFileStub.returns(JSON.stringify(mockCredentials))

      // First call should load the file and populate the map
      const result1 = await service.getCredentialsForOwner('test-owner')
      expect(result1).to.deep.equal({
        clientId: 'test-client',
        clientSecret: 'test-secret',
      })

      // Second call should use the map without reading the file again
      const result2 = await service.getCredentialsForOwner('another-owner')
      expect(result2).to.deep.equal({
        clientId: 'another-client',
        clientSecret: 'another-secret',
      })

      // Verify file was only read once
      expect(readCredentialsFileStub.calledOnce).to.equal(true)
      expect(readCredentialsFileStub.calledWith('/mock/path/to/credentials.json')).to.equal(true)
    })

    it('should throw error when file cannot be read', async () => {
      getCredentialsPathStub.returns('/mock/path/to/credentials.json')
      readCredentialsFileStub.throws(new Error('File not found'))

      try {
        await service.getCredentialsForOwner('test-owner')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.equal('File not found')
      }
    })

    it('should throw error when credential is missing required fields', async () => {
      const invalidCredentials = {
        credentials: [
          {
            username: 'test-client',
            // missing secret
            owner: 'test-owner',
          },
        ],
      }

      getCredentialsPathStub.returns('/mock/path/to/credentials.json')
      readCredentialsFileStub.returns(JSON.stringify(invalidCredentials))

      try {
        await service.getCredentialsForOwner('test-owner')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.contain('Invalid credentials file format:')
      }
    })
  })
})
