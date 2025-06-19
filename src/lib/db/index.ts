import { type Knex } from 'knex'
import { inject, singleton } from 'tsyringe'
import { z } from 'zod'

import Zod, { ColumnsByType, IDatabase, Models, Order, TABLE, Update, Where, tablesList } from './types.js'
import { reduceWhere } from './util.js'
import { KnexToken } from './knexClient.js'

@singleton()
export default class Database {
  private db: IDatabase

  constructor(@inject(KnexToken) private client: Knex) {
    const models: IDatabase = tablesList.reduce((acc, name) => {
      return {
        [name]: () => this.client(name),
        ...acc,
      }
    }, {}) as IDatabase
    this.db = models
  }

  insert = async <M extends TABLE>(
    model: M,
    record: Models[typeof model]['insert']
  ): Promise<Models[typeof model]['get'][]> => {
    return z.array(Zod[model].get).parse(await this.db[model]().insert(record).returning('*'))
  }

  delete = async <M extends TABLE>(model: M, where: Where<M>): Promise<void> => {
    return this.db[model]()
      .where(where || {})
      .delete()
  }

  update = async <M extends TABLE>(
    model: M,
    where: Where<M>,
    updates: Update<M>
  ): Promise<Models[typeof model]['get'][]> => {
    let query = this.db[model]().update({
      ...updates,
      updated_at: this.client.fn.now(),
    })
    query = reduceWhere(query, where)

    return z.array(Zod[model].get).parse(await query.returning('*'))
  }

  increment = async <M extends TABLE>(
    model: M,
    column: ColumnsByType<M, number>,
    where?: Where<M>,
    amount: number = 1
  ): Promise<Models[typeof model]['get'][]> => {
    let query = this.db[model]()
    query = reduceWhere(query, where)
    query = query.increment(column, amount)
    return z.array(Zod[model].get).parse(await query.returning('*'))
  }

  get = async <M extends TABLE>(
    model: M,
    where?: Where<M>,
    order?: Order<M>,
    limit?: number
  ): Promise<Models[typeof model]['get'][]> => {
    let query = this.db[model]()
    query = reduceWhere(query, where)
    if (order && order.length !== 0) {
      query = order.reduce((acc, [key, direction]) => acc.orderBy(key, direction), query)
    }
    if (limit !== undefined) query = query.limit(limit)
    const result = await query
    return z.array(Zod[model].get).parse(result)
  }

  withTransaction = (update: (db: Database) => Promise<void>) => {
    return this.client.transaction(async (trx) => {
      const decorated = new Database(trx)
      await update(decorated)
    })
  }
}
