import type express from 'express'

import { UnknownError } from '../error-handler/index.js'

export function trim0x(input: string): string {
  return input.startsWith('0x') ? input.slice(2) : input
}

export function getAuthorization(req: express.Request): string {
  const authorization = req.headers['authorization']
  if (!authorization) {
    throw new UnknownError()
  }
  return authorization
}
