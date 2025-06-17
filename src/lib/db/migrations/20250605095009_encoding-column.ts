import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachment', (def) => {
    def
      .enu('encoding', ['cidv0', 'cidv1', 'sha256'], {
        useNative: true,
        enumName: 'attachment_encoding_type',
      })
      .nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachment', (def) => {
    def.dropColumn('encoding')
  })
}
