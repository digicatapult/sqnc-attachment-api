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
  STORAGE_BACKEND_MODE: envalid.str({ devDefault: 'S3' }), // 'S3' (also set to S3 for minio) or 'AZURE' or 'IPFS'
  STORAGE_BACKEND_HOST: envalid.host({ devDefault: 'localhost' }),
  STORAGE_BACKEND_PORT: envalid.port({ devDefault: 4566 }),
  STORAGE_BACKEND_S3_REGION: envalid.str({ devDefault: 'eu-west-2' }),
  STORAGE_BACKEND_ACCESS_KEY_ID: envalid.str({ devDefault: 'bUSVDwGm5KsvrOAJ5keT' }), // for minio s3
  STORAGE_BACKEND_SECRET_ACCESS_KEY: envalid.str({ devDefault: 'MuFMyporttNkz6m94RcCQuMkMTChvAM4fkc71xC4' }), // for minio s3
  STORAGE_BACKEND_ACCOUNT_NAME: envalid.str({ devDefault: 'devstoreaccount1' }), // the accountName for azure
  STORAGE_BACKEND_ACCOUNT_SECRET: envalid.str({
    devDefault: 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==',
  }), // the accountKey for azurite
  STORAGE_BACKEND_PROTOCOL: envalid.str({ default: 'http', devDefault: 'http' }), // 'http' or 'https'
  STORAGE_BACKEND_BUCKET_NAME: envalid.str({ devDefault: 'test' }),
}
const env = envalid.cleanEnv(process.env, envSchema)

export default env

export const EnvToken = Symbol('Env')
export type Env = typeof env
