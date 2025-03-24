import request from 'supertest'
import express from 'express'

import env from '../../src/env.js'
import { z } from 'zod'

const accessTokenParser = z.object({
  access_token: z.string(),
})

const getToken = async (realm: 'internal' | 'sequence' = 'sequence') => {
  const tokenReq = await fetch(`http://localhost:3080/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.IDP_CLIENT_ID,
      client_secret: 'secret',
    }),
  })

  if (!tokenReq.ok) {
    throw new Error(`Error getting token from keycloak ${tokenReq.statusText}`)
  }

  const body = accessTokenParser.parse(await tokenReq.json())
  return body.access_token as string
}

export const get = async (
  app: express.Express,
  endpoint: string,
  headers: Record<string, string> = {}
): Promise<request.Test> => {
  const token = await getToken()
  const headersWithToken = {
    authorization: `bearer ${token}`,
    ...headers,
  }
  return request(app).get(endpoint).set(headersWithToken)
}

export const post = async (
  app: express.Express,
  endpoint: string,
  body: object,
  headers: Record<string, string> = {}
): Promise<request.Test> => {
  const token = await getToken()
  const headersWithToken = {
    authorization: `bearer ${token}`,
    ...headers,
  }
  return request(app).post(endpoint).send(body).set(headersWithToken)
}

export const postInternal = async (
  app: express.Express,
  endpoint: string,
  body: object,
  headers: Record<string, string> = {}
): Promise<request.Test> => {
  const token = await getToken('internal')
  const headersWithToken = {
    authorization: `bearer ${token}`,
    ...headers,
  }
  return request(app).post(endpoint).send(body).set(headersWithToken)
}

export const postFile = async (
  app: express.Express,
  endpoint: string,
  buf: Buffer,
  filename: string,
  headers: Record<string, string> = { accept: 'application/octect-stream' }
): Promise<request.Test> => {
  const token = await getToken()
  const headersWithToken = {
    authorization: `bearer ${token}`,
    ...headers,
  }
  return request(app).post(endpoint).set(headersWithToken).attach('file', buf, filename)
}
