import { pino, Logger } from 'pino'

import env from '../env.js'
import { container } from 'tsyringe'

export const logger: Logger = pino(
  {
    name: 'sqnc-attachment-api',
    timestamp: true,
    level: env.LOG_LEVEL,
  },
  process.stdout
)

export const LoggerToken = Symbol('Logger')
container.register<Logger>(LoggerToken, { useValue: logger })
