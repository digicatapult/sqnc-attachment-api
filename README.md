# sqnc-attachment-api

## Description

An API facilitating file attachment storage in Digital Catapult's [Sequence](https://github.com/digicatapult/sqnc-documentation) (SQNC) ledger-based solution

## Configuration

Use a `.env` at root of the repository to set values for the environment variables defined in `.env` file.

| variable                   | required |        default         | description                                                                                                                                           |
| :------------------------- | :------: | :--------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT                       |    N     |         `3000`         | The port for the API to listen on                                                                                                                     |
| DB_PORT                    |    N     |         `5432`         | The port for the database                                                                                                                             |
| DB_HOST                    |    Y     |           -            | The database hostname / host                                                                                                                          |
| DB_NAME                    |    N     | `sqnc-attachment-api ` | The database name                                                                                                                                     |
| DB_USERNAME                |    Y     |           -            | The database username                                                                                                                                 |
| DB_PASSWORD                |    Y     |           -            | The database password                                                                                                                                 |
| IDENTITY_SERVICE_HOST      |    Y     |           -            | Hostname of the `sqnc-identity-service`                                                                                                               |
| IDENTITY_SERVICE_PORT      |    N     |         `3000`         | Port of the `sqnc-identity-service`                                                                                                                   |
| LOG_LEVEL                  |    N     |         `info`         | Logging level. Valid values are [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]                                                                  |
| IPFS_HOST                  |    Y     |           -            | Hostname of the `IPFS` node to use for metadata storage                                                                                               |
| IPFS_PORT                  |    N     |         `5001`         | Port of the `IPFS` node to use for metadata storage                                                                                                   |
| WATCHER_POLL_PERIOD_MS     |    N     |        `10000`         | Number of ms between polling of service state                                                                                                         |
| WATCHER_TIMEOUT_MS         |    N     |         `2000`         | Timeout period in ms for service state                                                                                                                |
| API_SWAGGER_BG_COLOR       |    N     |       `#fafafa`        | CSS \_color\* val for UI bg ( try: [e4f2f3](https://coolors.co/e4f2f3) , [e7f6e6](https://coolors.co/e7f6e6) or [f8dddd](https://coolors.co/f8dddd) ) |
| API_SWAGGER_TITLE          |    N     |     `IdentityAPI`      | String used to customise the title of the html page                                                                                                   |
| API_SWAGGER_HEADING        |    N     |   `IdentityService`    | String used to customise the H2 heading                                                                                                               |
| IDP_CLIENT_ID              |    Y     |           -            | OAuth2 client-id to use in swagger-ui                                                                                                                 |
| IDP_INTERNAL_CLIENT_ID     |    Y     |           -            | Client Id to authenticate internal requests using OIDC                                                                                                |
| IDP_INTERNAL_CLIENT_SECRET |    Y     |           -            | Client secret to authenticate internal requests using OIDC                                                                                            |
| IDP_PUBLIC_ORIGIN          |    Y     |           -            | Origin of IDP from outside the cluster                                                                                                                |
| IDP_INTERNAL_ORIGIN        |    Y     |           -            | Origin of IDP from inside the cluster                                                                                                                 |
| IDP_PATH_PREFIX            |    N     |        `/auth`         | Path prefix to use when constructing IDP API paths.                                                                                                   |
| IDP_OAUTH2_REALM           |    Y     |           -            | Realm to use when authenticating users owned by this instance's organisation                                                                          |
| IDP_INTERNAL_REALM         |    Y     |           -            | Realm to use when authenticating cluster internal users                                                                                               |
| IDP_EXTERNAL_REALM         |    Y     |           -            | Realm to use when authenticating users owned by external organisations                                                                                |
| AUTHZ_WEBHOOK              |    N     |          ` `           | Webhook to use for authorization of an external attachment fetch request. See [Attachment authorization webhook](#attachment-authorization-webhook)   |

### Attachment authorization webhook

As well as being able to access attachments via the usual API it is also possible to grant external clients access to only attachments relevant for them based on a configured policy webhook. Clients within the `IDP_EXTERNAL_REALM` are subject to additional authorization checks which are performed by a `POST` request to the `AUTHZ_WEBHOOK` URL. This request is authenticated using the `IDP_INTERNAL_CLIENT_ID` client within the realm `IDP_INTERNAL_REALM` and is intended to be used by a domain specific Sequence service such as the `sqnc-matchmaker-api`. Clients in this realm are expected to have the property `organisation.chainAccount` embedded in the JWT payload of valid tokens the value of which is the `SS58` address of the calling organisation (e.g. `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`).

The request made to `AUTHZ_WEBHOOK` then has the following body format:

```json
{
  "input": {
    "resourceType": "attachment",
    "resourceId": "a69417ad-a411-4592-84c8-79b7dd5bd599",
    "accountAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  }
}
```

With a successful authorization returning a `2xx` response code and a body of:

```json
{
  "result": {
    "allow": true
  }
}
```

Any non `2xx` response code or a body not following this format is interpreted as unauthorised.

Note this only grants access to the `GET /attachment/{idOrHash}` API for retrieving attachment contents.

## Getting started

```sh
# start dependencies
docker compose up -d
# install packages
npm i
# run migrations
npm run db:migrate
# start service in dev mode. In order to start in full - npm start"
npm run dev
```

If you want to see telemetry (this brings up jaeger and exports logs to it)

```sh
# start dependencies with
docker-compose -f ./docker-compose.yml -f ./docker-compose.telemetry.yml up -d
# install packages
npm i
# run migrations
npm run db:migrate
# start service in dev mode. In order to start in full - npm start"
npm run dev:telemetry
```

View OpenAPI documentation for all routes with Swagger:

```
localhost:3000/swagger/
```

## Database

> before performing any database interactions like clean/migrate make sure you have database running e.g. docker-compose up -d
> or any local instance if not using docker

```sh
# running migrations
npm run db:migrate

# creating new migration
## install npx globally
npm i -g knex
## make new migration with some prefixes
npx knex migrate:make attachment-table
```

## Tests

Unit tests are executed by calling:

```sh
npm run test:unit
```

Integration tests require the test dependency services be brought up using docker:

```sh
# start dependencies
docker compose -f ./docker-compose-test.yml up -d
# install packages
npm ci
# run migrations
npm run db:migrate
```

Integration tests are then executed by calling (tests are set up in a way where we are a proxy for Dave by default):

```sh
npm run test:integration
```

## API design

`sqnc-attachment-api` provides a RESTful OpenAPI-based interface for third parties and front-ends to interact with attachments in `Sequence` (SQNC). The design prioritises:

1. RESTful design principles:
   - all endpoints describing discrete operations on path derived entities.
   - use of HTTP verbs to describe whether state is modified, whether the action is idempotent etc.
   - HTTP response codes indicating the correct status of the request.
   - HTTP response bodies including the details of a query response or details about the entity being created/modified.
2. Simplicity of structure. The API should be easily understood by a third party and traversable.
3. Simplicity of usage:
   - all APIs that take request bodies taking a JSON structured request with the exception of attachment upload (which is idiomatically represented as a multipart form).
   - all APIs which return a body returning a JSON structured response (again with the exception of attachments.
4. Abstraction of the underlying DLT components. This means no token Ids, no block numbers etc.
5. Conflict free identifiers. All identifiers must be conflict free as updates can come from third party organisations.

### Authentication

The API is authenticated and should be accessed with an OAuth2 JWT Bearer token obtained following the OAuth2 client-credentials flow against the deployment's identity-provider.

### Attachment entities

The top level entity `attachment`, which accepts a `multipart/form-data` payload for uploading a file or `application/json` for uploading JSON as a file. This will return an `id` that can then be used when preparing entity updates to attach files.

- `POST /v1/attachment` - upload a file.
- `GET /v1/attachment` - list attachments.
- `GET /v1/attachment/{attachmentId}` - download an attachment.
