import { Knex } from 'knex'
import { z } from 'zod'

export const tablesList = ['attachment'] as const

const insertAttachment = z.object({
  owner: z.string(),
  filename: z.union([z.string(), z.null()]),
  size: z.union([
    z.number().int().gte(0),
    z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .transform((s) => parseFloat(s)),
    z.null(),
  ]),
  integrity_hash: z.string(),
})

const defaultFields = z.object({
  id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
})

const Zod = {
  attachment: {
    insert: insertAttachment,
    get: insertAttachment.merge(defaultFields),
  },
}

export type InsertAttachment = z.infer<typeof Zod.attachment.insert>
export type AttachmentRow = z.infer<typeof Zod.attachment.get>

export type TABLES_TUPLE = typeof tablesList
export type TABLE = TABLES_TUPLE[number]
export type Models = {
  [key in TABLE]: {
    get: z.infer<(typeof Zod)[key]['get']>
    insert: Partial<z.infer<(typeof Zod)[key]['get']>> & z.infer<(typeof Zod)[key]['insert']>
  }
}

export type ColumnsByType<M extends TABLE, T> = {
  [K in keyof Models[M]['get']]-?: Models[M]['get'][K] extends T ? K : never
}[keyof Models[M]['get']]

type WhereComparison<M extends TABLE> = {
  [key in keyof Models[M]['get']]: Readonly<
    [
      Extract<key, string>,
      '=' | '>' | '>=' | '<' | '<=' | '<>' | 'LIKE' | 'ILIKE',
      Extract<Models[M]['get'][key], Knex.Value>,
    ]
  >
}
export type WhereMatch<M extends TABLE> = {
  [key in keyof Models[M]['get']]?: Models[M]['get'][key]
}

export type Where<M extends TABLE> = WhereMatch<M> | (WhereMatch<M> | WhereComparison<M>[keyof Models[M]['get']])[]
export type Order<M extends TABLE> = [keyof Models[M]['get'], 'asc' | 'desc'][]
export type Update<M extends TABLE> = Partial<Models[M]['get']>

export type IDatabase = {
  [key in TABLE]: () => Knex.QueryBuilder
}

export default Zod
