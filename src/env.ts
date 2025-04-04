import * as envalid from 'envalid'
import dotenv from 'dotenv'
import { container } from 'tsyringe'

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'test/test.env' })
} else if (process.env.NODE_ENV === 'proxyless') {
  dotenv.config({ path: 'test/proxyless.test.env' })
} else {
  dotenv.config()
}

const env = envalid.cleanEnv(process.env, {
  PORT: envalid.port({ default: 3000 }),
  LOG_LEVEL: envalid.str({ default: 'info', devDefault: 'debug' }),
  DB_HOST: envalid.str({ devDefault: 'localhost' }),
  DB_PORT: envalid.port({ default: 5432 }),
  DB_USERNAME: envalid.str({ devDefault: 'postgres' }),
  DB_PASSWORD: envalid.str({ devDefault: 'postgres' }),
  DB_NAME: envalid.str({ default: 'sqnc-attachment-api' }),
  IPFS_HOST: envalid.host({ devDefault: 'localhost' }),
  IPFS_PORT: envalid.port({ default: 5001 }),
  IDENTITY_SERVICE_HOST: envalid.host({ devDefault: 'localhost' }),
  IDENTITY_SERVICE_PORT: envalid.port({ devDefault: 3002, default: 3000 }),
  WATCHER_POLL_PERIOD_MS: envalid.num({ default: 10 * 1000 }),
  WATCHER_TIMEOUT_MS: envalid.num({ default: 2 * 1000 }),
  API_SWAGGER_BG_COLOR: envalid.str({ default: '#fafafa' }),
  API_SWAGGER_TITLE: envalid.str({ default: 'AttachmentAPI' }),
  API_SWAGGER_HEADING: envalid.str({ default: 'AttachmentAPI' }),
  IDP_CLIENT_ID: envalid.str({ devDefault: 'sequence' }),
  IDP_PUBLIC_ORIGIN: envalid.url({
    devDefault: 'http://localhost:3080',
  }),
  IDP_INTERNAL_ORIGIN: envalid.url({
    devDefault: 'http://localhost:3080',
  }),
  IDP_PATH_PREFIX: envalid.str({
    default: '/auth',
    devDefault: '',
  }),
  IDP_OAUTH2_REALM: envalid.str({
    devDefault: 'sequence',
  }),
  IDP_INTERNAL_REALM: envalid.str({
    devDefault: 'internal',
  }),
})

export default env

export const EnvToken = Symbol('Env')
export type Env = typeof env

container.register<Env>(EnvToken, {
  useValue: env,
})
