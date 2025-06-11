import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachment', (def) => {
    def.enum('encoding', ['cidv0', 'cidv1', 'sha256']).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachment', (def) => {
    def.dropColumn('encoding')
  })
}
