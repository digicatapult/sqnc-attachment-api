import knex, { type Knex } from 'knex'
import { pgConfig } from './knexfile.js'

export const clientSingleton: Knex = knex(pgConfig)

export const KnexToken = Symbol('KnexClient')
