import 'reflect-metadata'
import { Express } from 'express'

import Server from './server.js'
import env from './env.js'
import { logger } from './lib/logger.js'
;(async () => {
  const app: Express = await Server()

  app.listen(env.PORT, () => {
    logger.info(`sqnc-attachment-api listening on ${env.PORT} port`)
  })
})()
