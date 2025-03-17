export const pgConfig = {
  client: 'pg',
  timezone: 'UTC',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sqnc-attachment-api',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || '5432',
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'migrations',
    directory: './src/lib/db/migrations',
  },
}

const config = {
  test: pgConfig,
  development: pgConfig,
  production: {
    ...pgConfig,
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || ''),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      ...pgConfig.migrations,
      directory: './build/lib/db/migrations',
    },
  },
}

export default config
