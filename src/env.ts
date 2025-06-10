import * as envalid from 'envalid'
import dotenv from 'dotenv'

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'test/test.env' })
} else if (process.env.NODE_ENV === 'proxyless') {
  dotenv.config({ path: 'test/proxyless.test.env' })
} else {
  dotenv.config()
}

export const envSchema = {
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
  IDP_INTERNAL_CLIENT_ID: envalid.str({ devDefault: 'sequence' }),
  IDP_INTERNAL_CLIENT_SECRET: envalid.str({ devDefault: 'secret' }),
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
  IDP_EXTERNAL_REALM: envalid.str({
    devDefault: 'external',
  }),
  AUTHZ_WEBHOOK: envalid.url({
    default: '',
    devDefault: 'http://www.example.com/authz',
  }),
  CREDENTIALS_FILE_PATH: envalid.str({
    devDefault: 'docker/config/credentials.json',
  }),
  STORAGE_BACKEND_MODE: envalid.str({ devDefault: 'ipfs' }), // 's3' or 'azure' or 'ipfs'
  S3_HOST: envalid.host({ devDefault: 'localhost' }),
  S3_PORT: envalid.port({ devDefault: 4566 }),
  S3_REGION: envalid.str({ devDefault: 'eu-west-2' }), // unnecessary if we'll never wan to change this
  AZURE_HOST: envalid.host({ devDefault: 'localhost' }),
  AZURE_PORT: envalid.port({ devDefault: 10000 }),
  STORAGE_ACCESS_KEY: envalid.str({ devDefault: 'devstoreaccount1' }), // the accountName
  STORAGE_SECRET_KEY: envalid.str({
    devDefault: 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==',
  }), // the accountKey
  STORAGE_PROTOCOL: envalid.str({ default: 'http', devDefault: 'http' }), // 'http' or 'https'
  STORAGE_BUCKET_NAME: envalid.str({ default: 'test' }),
}
const env = envalid.cleanEnv(process.env, envSchema)

export default env

export const EnvToken = Symbol('Env')
export type Env = typeof env
