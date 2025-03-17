import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, Dispatcher } from 'undici'
import env from '../../src/env.js'

export const selfAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
export const notSelfAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'

export type MockContext = {
  originalDispatcher?: Dispatcher
  mockAgent?: MockAgent
}

export const withIpfsMock = (fileContent: string | object | Buffer, context: MockContext) => {
  beforeEach(function () {
    context.originalDispatcher = context.originalDispatcher || getGlobalDispatcher()
    if (!context.mockAgent) {
      context.mockAgent = new MockAgent()
      setGlobalDispatcher(context.mockAgent)
    }

    const mockIpfs = context.mockAgent.get(`http://${env.IPFS_HOST}:${env.IPFS_PORT}`)

    mockIpfs
      .intercept({
        path: '/api/v0/add?cid-version=0&wrap-with-directory=true',
        method: 'POST',
      })
      .reply(200, { Name: '', Hash: 'hash1', Size: '63052' })

    mockIpfs
      .intercept({
        path: '/api/v0/ls?arg=hash1',
        method: 'POST',
      })
      .reply(200, {
        Objects: [{ Links: [{ Hash: 'file_hash', Name: 'test' }] }],
      })
    if (fileContent) {
      mockIpfs
        .intercept({
          path: '/api/v0/cat?arg=file_hash',
          method: 'POST',
        })
        .reply(200, fileContent)
    }
  })

  afterEach(function () {
    if (context.originalDispatcher) {
      setGlobalDispatcher(context.originalDispatcher)
      delete context.originalDispatcher
      delete context.mockAgent
    }
  })
}

export const withIpfsMockError = (context: MockContext) => {
  beforeEach(function () {
    context.originalDispatcher = context.originalDispatcher || getGlobalDispatcher()
    if (!context.mockAgent) {
      context.mockAgent = new MockAgent()
      setGlobalDispatcher(context.mockAgent)
    }

    const mockIpfs = context.mockAgent.get(`http://${env.IPFS_HOST}:${env.IPFS_PORT}`)

    mockIpfs
      .intercept({
        path: '/api/v0/add?cid-version=0&wrap-with-directory=true',
        method: 'POST',
      })
      .reply(500, 'error')
  })

  afterEach(function () {
    if (context.originalDispatcher) {
      setGlobalDispatcher(context.originalDispatcher)
      delete context.originalDispatcher
      delete context.mockAgent
    }
  })
}

export const withIdentityMock = (context: MockContext) => {
  beforeEach(function () {
    context.originalDispatcher = context.originalDispatcher || getGlobalDispatcher()
    if (!context.mockAgent) {
      context.mockAgent = new MockAgent()
      setGlobalDispatcher(context.mockAgent)
    }

    const mockIdentity = context.mockAgent.get(`http://${env.IDENTITY_SERVICE_HOST}:${env.IDENTITY_SERVICE_PORT}`)

    mockIdentity
      .intercept({
        path: '/v1/self',
        method: 'GET',
      })
      .reply(200, {
        alias: 'self',
        address: selfAddress,
      })

    mockIdentity
      .intercept({
        path: '/v1/members/self',
        method: 'GET',
      })
      .reply(200, {
        alias: 'self',
        address: selfAddress,
      })

    mockIdentity
      .intercept({
        path: `/v1/members/${selfAddress}`,
        method: 'GET',
      })
      .reply(200, {
        alias: 'self',
        address: selfAddress,
      })

    mockIdentity
      .intercept({
        path: `/v1/members/${notSelfAddress}`,
        method: 'GET',
      })
      .reply(200, {
        alias: 'other',
        address: notSelfAddress,
      })

    mockIdentity
      .intercept({
        path: '/v1/members/other',
        method: 'GET',
      })
      .reply(200, {
        alias: 'other',
        address: notSelfAddress,
      })
  })

  afterEach(function () {
    if (context.originalDispatcher) {
      setGlobalDispatcher(context.originalDispatcher)
      delete context.originalDispatcher
      delete context.mockAgent
    }
  })
}

export const withHealthyDeps = (context: MockContext) => {
  beforeEach(function () {
    context.originalDispatcher = context.originalDispatcher || getGlobalDispatcher()
    if (!context.mockAgent) {
      context.mockAgent = new MockAgent()
      setGlobalDispatcher(context.mockAgent)
    }

    const mockIdentity = context.mockAgent.get(`http://${env.IDENTITY_SERVICE_HOST}:${env.IDENTITY_SERVICE_PORT}`)

    mockIdentity
      .intercept({
        path: '/health',
        method: 'GET',
      })
      .reply(200, {
        status: 'ok',
        version: '1.0.0',
      })

    const mockIpfs = context.mockAgent.get(`http://${env.IPFS_HOST}:${env.IPFS_PORT}`)

    mockIpfs
      .intercept({
        path: '/api/v0/version',
        method: 'POST',
      })
      .reply(200, {
        Version: '2.0.0',
      })

    mockIpfs
      .intercept({
        path: '/api/v0/swarm/peers',
        method: 'POST',
      })
      .reply(200, {
        Peers: [
          {
            Addr: 'abc',
            Peer: '123',
          },
        ],
      })
  })

  afterEach(function () {
    if (context.originalDispatcher) {
      setGlobalDispatcher(context.originalDispatcher)
      delete context.originalDispatcher
      delete context.mockAgent
    }
  })
}
