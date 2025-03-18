# Database usage

## Database migrations

Database migrations are handled using [`knex.js`](https://knexjs.org/) and can be migrated manually using the following commands:

```sh
npm run db:migrate # used to migrate to latest database version
npx knex migrate:up # used to migrate to the next database version
npx knex migrate:down # used to migrate to the previous database version
```

## Table structure

The following tables exist in the `sqnc-attachment-api` database.

### `attachment`

| column           | PostgreSQL type           | nullable |       default        | description                                  |
| :--------------- | :------------------------ | :------- | :------------------: | :------------------------------------------- |
| `id`             | `UUID`                    | FALSE    | `uuid_generate_v4()` | Unique identifier for the `attachment`       |
| `owner`          | `CHARACTER VARYING (255)` | false    |          -           | Attachment filename                          |
| `integrity_hash` | `CHARACTER VARYING (255)` | FALSE    |          -           | Attachment file hash for verifying integrity |
| `filename`       | `CHARACTER VARYING (255)` | TRUE     |          -           | Attachment filename                          |
| `size`           | `BIG INT`                 | TRUE     |          -           | Size of file in bytes if known               |
| `created_at`     | `dateTime`                | FALSE    |       `now()`        | When the row was first created               |
| `updated_at`     | `dateTime`                | FALSE    |       `now()`        | When the row was last updated                |

#### Indexes

```
def.index('integrity_hash')
def.index(['owner', 'integrity_hash'])
def.index('updated_at')
```

| columns                   | Index Type | description                                                                                                                   |
| :------------------------ | :--------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | PRIMARY    | Primary key                                                                                                                   |
| `integrity_hash`          | INDEX      | Index for looking up attachment by it's integrity hash                                                                        |
| `owner`, `integrity_hash` | INDEX      | Index for looking up attachment by it's owner and hash. Used for example by matchmaker when checking for attachment existence |
| `updated_at`              | INDEX      | Used to search attachments by modified since                                                                                  |
