import 'reflect-metadata'
import { Express } from 'express'

import Server from './server.js'
import env, { type Env, EnvToken } from './env.js'
import { logger } from './lib/logger.js'
import { container } from 'tsyringe'
import { resetContainer } from './ioc.js'
;(async () => {
  resetContainer()
  const env = container.resolve<Env>(EnvToken)
  const app: Express = await Server()

  app.listen(env.PORT, () => {
    logger.info(`sqnc-attachment-api listening on ${env.PORT} port`)
  })
})()
