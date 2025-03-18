import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const [extInstalled] = await knex('pg_extension').select('*').where({ extname: 'uuid-ossp' })

  if (!extInstalled) await knex.raw('CREATE EXTENSION "uuid-ossp"')

  await knex.schema.createTable('attachment', (def) => {
    def.uuid('id').defaultTo(knex.raw('uuid_generate_v4()'))
    def.string('integrity_hash').notNullable()
    def.string('owner').notNullable()
    def.string('filename', 255).nullable()
    def.bigInteger('size').nullable()
    def.datetime('created_at').notNullable().defaultTo(knex.fn.now())
    def.datetime('updated_at').notNullable().defaultTo(knex.fn.now())

    def.primary(['id'])
    def.index('integrity_hash')
    def.index(['owner', 'integrity_hash'])
    def.index('updated_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('attachment')
  await knex.raw('DROP EXTENSION "uuid-ossp"')
}
