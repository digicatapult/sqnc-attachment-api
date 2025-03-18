import { describe, it } from 'mocha'
import { expect } from 'chai'

import { parseDateParam } from '../queryParams.js'
import { BadRequest } from '../../error-handler/index.js'

describe('parseDateParam', function () {
  it('should return parsed date is str is valid date', function () {
    const result = parseDateParam('2023-05-04T09:47:32.393Z')
    expect(result).instanceOf(Date)
    expect(result).to.deep.equal(new Date('2023-05-04T09:47:32.393Z'))
  })

  it('should throw BadRequest error if date is invalid', function () {
    let error: Error | null = null
    try {
      parseDateParam('foo')
    } catch (err) {
      error = err as Error
    }
    expect(error).instanceOf(BadRequest)
  })
})
