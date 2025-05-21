import { describe, it } from 'mocha'
import { container } from 'tsyringe'
import { Credentials } from '../index.js'
import { expect } from 'chai'

describe('Credentials', () => {
  let service: Credentials

  beforeEach(() => {
    service = container.resolve(Credentials)
  })

  afterEach(() => {})

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
