import { IocContainer } from '@tsoa/runtime'
import { container } from 'tsyringe'
import { Logger } from 'pino'

import env, { type Env, EnvToken } from './env.js'
import { logger, LoggerToken } from './lib/logger.js'
import { Knex } from 'knex'
import { clientSingleton, KnexToken } from './lib/db/knexClient.js'
import StorageClass, { StorageToken } from './lib/storageClass/index.js'
import Ipfs from './lib/ipfs.js'
export const iocContainer: IocContainer = {
  get: (controller) => {
    return container.resolve(controller as never)
  },
}

export function resetContainer() {
  container.clearInstances()
  container.registerInstance<Env>(EnvToken, env)
  container.register<Logger>(LoggerToken, { useValue: logger })
  container.register<Knex>(KnexToken, { useValue: clientSingleton })
  // Only register StorageClass if using S3 or Azure
  if (env.STORAGE_BACKEND_MODE === 'S3' || env.STORAGE_BACKEND_MODE === 'AZURE') {
    container.registerSingleton(StorageToken, StorageClass)
  }
  if (env.STORAGE_BACKEND_MODE === 'IPFS') {
    container.registerSingleton(StorageToken, Ipfs)
  }
}
