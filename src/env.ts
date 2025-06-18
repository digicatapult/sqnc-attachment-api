import * as envalid from 'envalid'
import dotenv from 'dotenv'

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'test/test.env' })
} else if (process.env.NODE_ENV === 'proxyless') {
  dotenv.config({ path: 'test/proxyless.test.env' })
} else {
  dotenv.config()
}

// Base environment type that's common to all storage modes
type BaseEnv = {
  PORT: number
  LOG_LEVEL: string
  DB_HOST: string
  DB_PORT: number
  DB_USERNAME: string
  DB_PASSWORD: string
  DB_NAME: string
  IDENTITY_SERVICE_HOST: string
  IDENTITY_SERVICE_PORT: number
  WATCHER_POLL_PERIOD_MS: number
  WATCHER_TIMEOUT_MS: number
  API_SWAGGER_BG_COLOR: string
  API_SWAGGER_TITLE: string
  API_SWAGGER_HEADING: string
  IDP_CLIENT_ID: string
  IDP_INTERNAL_CLIENT_ID: string
  IDP_INTERNAL_CLIENT_SECRET: string
  IDP_PUBLIC_ORIGIN: string
  IDP_INTERNAL_ORIGIN: string
  IDP_PATH_PREFIX: string
  IDP_OAUTH2_REALM: string
  IDP_INTERNAL_REALM: string
  IDP_EXTERNAL_REALM: string
  AUTHZ_WEBHOOK: string
  CREDENTIALS_FILE_PATH: string
  STORAGE_BACKEND_MODE: 'S3' | 'AZURE' | 'IPFS'
}

// Specific types for each storage mode
type S3Env = BaseEnv & {
  STORAGE_BACKEND_MODE: 'S3'
  STORAGE_BACKEND_HOST: string
  STORAGE_BACKEND_PORT: number
  STORAGE_BACKEND_S3_REGION: string
  STORAGE_BACKEND_ACCESS_KEY_ID: string
  STORAGE_BACKEND_SECRET_ACCESS_KEY: string
  STORAGE_BACKEND_PROTOCOL: string
  STORAGE_BACKEND_BUCKET_NAME: string
}

type AzureEnv = BaseEnv & {
  STORAGE_BACKEND_MODE: 'AZURE'
  STORAGE_BACKEND_HOST: string
  STORAGE_BACKEND_PORT: number
  STORAGE_BACKEND_ACCOUNT_NAME: string
  STORAGE_BACKEND_ACCOUNT_SECRET: string
  STORAGE_BACKEND_PROTOCOL: string
  STORAGE_BACKEND_BUCKET_NAME: string
}

type IPFSEnv = BaseEnv & {
  STORAGE_BACKEND_MODE: 'IPFS'
  IPFS_HOST: string
  IPFS_PORT: number
}

// Union type of all possible env configurations
type Env = S3Env | AzureEnv | IPFSEnv

export const baseSchema = {
  PORT: envalid.port({ default: 3000 }),
  LOG_LEVEL: envalid.str({ default: 'info', devDefault: 'debug' }),
  DB_HOST: envalid.str({ devDefault: 'localhost' }),
  DB_PORT: envalid.port({ default: 5432 }),
  DB_USERNAME: envalid.str({ devDefault: 'postgres' }),
  DB_PASSWORD: envalid.str({ devDefault: 'postgres' }),
  DB_NAME: envalid.str({ default: 'sqnc-attachment-api' }),
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
  STORAGE_BACKEND_MODE: envalid.str({ devDefault: 'S3', choices: ['S3', 'AZURE', 'IPFS'] }), // 'S3' (also set to S3 for minio) or 'AZURE' or 'IPFS'
}

export const ipfsSchema = {
  IPFS_HOST: envalid.host({ devDefault: 'localhost' }),
  IPFS_PORT: envalid.port({ default: 5001 }),
}

export const s3Schema = {
  STORAGE_BACKEND_HOST: envalid.host({ devDefault: 'localhost' }),
  STORAGE_BACKEND_PORT: envalid.port({ default: 9000 }),
  STORAGE_BACKEND_S3_REGION: envalid.str({ devDefault: 'eu-west-2' }),
  STORAGE_BACKEND_ACCESS_KEY_ID: envalid.str({ devDefault: 'minio' }),
  STORAGE_BACKEND_SECRET_ACCESS_KEY: envalid.str({ devDefault: 'password' }),
  STORAGE_BACKEND_PROTOCOL: envalid.str({ default: 'http', devDefault: 'http' }),
  STORAGE_BACKEND_BUCKET_NAME: envalid.str({ devDefault: 'test' }),
}

export const azureSchema = {
  STORAGE_BACKEND_HOST: envalid.host({ devDefault: 'localhost' }),
  STORAGE_BACKEND_PORT: envalid.port({ default: 10000 }),
  STORAGE_BACKEND_ACCOUNT_NAME: envalid.str({ devDefault: 'devstoreaccount1' }),
  STORAGE_BACKEND_ACCOUNT_SECRET: envalid.str({
    devDefault: 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==',
  }),
  STORAGE_BACKEND_PROTOCOL: envalid.str({ default: 'http', devDefault: 'http' }),
  STORAGE_BACKEND_BUCKET_NAME: envalid.str({ devDefault: 'test' }),
}

function getStorageSchema(storageMode: string) {
  switch (storageMode.toUpperCase()) {
    case 'IPFS':
      return { ...baseSchema, ...ipfsSchema }
    case 'S3':
      return { ...baseSchema, ...s3Schema }
    case 'AZURE':
      return { ...baseSchema, ...azureSchema }
    default:
      throw new Error(`Invalid storage mode: ${storageMode}. Must be one of: IPFS, S3, AZURE`)
  }
}

// Get the storage mode first
const tempEnv = envalid.cleanEnv(process.env, baseSchema) // only so we can check the storage mode
const storageMode = tempEnv.STORAGE_BACKEND_MODE
if (!storageMode) {
  throw new Error('STORAGE_BACKEND_MODE is not set')
}
export const envSchema = getStorageSchema(storageMode)

const env = envalid.cleanEnv(process.env, envSchema) as Env

export default env

export const EnvToken = Symbol('Env')
export type { Env, S3Env, AzureEnv, IPFSEnv }
