import { describe, it } from 'mocha'
import { container } from 'tsyringe'
import { Credentials } from '../index.js'
import { expect } from 'chai'
import sinon from 'sinon'
import * as path from 'path'

describe('Credentials', () => {
  let service: Credentials

  beforeEach(() => {
    service = container.resolve(Credentials)
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

    it('should successfully retrieve credentials from mock file', async () => {
      const mockCredentials = {
        credentials: [
          {
            username: 'test-client',
            secret: 'test-secret',
            owner: 'test-owner',
          },
        ],
      }

      getCredentialsPathStub.returns('/mock/path/to/credentials.json')
      readCredentialsFileStub.returns(JSON.stringify(mockCredentials))

      const result = await service.getCredentialsForOwner('test-owner')

      expect(result).to.deep.equal({
        clientId: 'test-client',
        clientSecret: 'test-secret',
      })
      expect(getCredentialsPathStub.called).to.be.true
      expect(readCredentialsFileStub.calledWith('/mock/path/to/credentials.json')).to.be.true
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

    it('should throw error when test-config.json has invalid format', async () => {
      const testConfigPath = path.resolve(process.cwd(), 'docker/config/test-config.json')
      getCredentialsPathStub.returns(testConfigPath)
      readCredentialsFileStub.returns('{}') // Empty JSON object

      try {
        await service.getCredentialsForOwner('test-owner')
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).to.be.an('Error')
        expect(error.message).to.equal(
          'Failed to parse credentials file: Invalid credentials file format. Expected { credentials: [] }'
        )
      }
    })
  })
})
