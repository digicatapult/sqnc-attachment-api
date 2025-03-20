import { describe, before, it } from 'mocha'
import { expect } from 'chai'
import { Express } from 'express'

import createHttpServer from '../../src/server.js'
import { get } from '../helper/routeHelper.js'
import { MockContext, withHealthyDeps } from '../helper/mock.js'

describe('health checks', function () {
  let app: Express
  const context: MockContext = {}

  withHealthyDeps(context)

  beforeEach(async () => {
    app = await createHttpServer()
  })

  it('returns 200 along with the report', async () => {
    const packageVersion = process.env.npm_package_version ? process.env.npm_package_version : 'unknown'

    const { status, body } = await get(app, '/health')
    expect(status).to.equal(200)

    const semverRegex = /^\d+\.\d+\.\d+$/
    const ipfsVersion = body['details']['ipfs']['detail']['version']
    const identityVersion = body['details']['identity']['detail']['version']

    expect(ipfsVersion).to.match(semverRegex, `ipfsVersion "${ipfsVersion}" does not follow SemVer`)
    expect(identityVersion).to.match(semverRegex, `identityVersion "${identityVersion}" does not follow SemVer`)

    expect(body).to.deep.equal({
      status: 'ok',
      version: packageVersion,
      details: {
        ipfs: { status: 'ok', detail: { version: ipfsVersion, peerCount: 1 } },
        identity: { status: 'ok', detail: { version: identityVersion } },
      },
    })
  })
})
