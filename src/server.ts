import express, { Express } from 'express'
import { setup, serve, SwaggerUiOptions } from 'swagger-ui-express'
import cors from 'cors'
import bodyParser from 'body-parser'
import promBundle from 'express-prom-bundle'

import { errorHandler } from './lib/error-handler/index.js'
import { RegisterRoutes } from './routes.js'
import env from './env.js'
import loadApiSpec from './swagger.js'
import multer from 'multer'

const API_SWAGGER_BG_COLOR = env.API_SWAGGER_BG_COLOR
const API_SWAGGER_TITLE = env.API_SWAGGER_TITLE

const customCssToInject: string = `
  body { background-color: ${API_SWAGGER_BG_COLOR}; }
  .swagger-ui .scheme-container { background-color: inherit; }
  .swagger-ui .opblock .opblock-section-header { background: inherit; }
  .topbar { display: none; }
  .swagger-ui .btn.authorize { background-color: #f7f7f7; }
  .swagger-ui .opblock.opblock-post { background: rgba(73,204,144,.3); }
  .swagger-ui .opblock.opblock-get { background: rgba(97,175,254,.3); }
  .swagger-ui .opblock.opblock-put { background: rgba(252,161,48,.3); }
  .swagger-ui .opblock.opblock-delete { background: rgba(249,62,62,.3); }
  .swagger-ui section.models { background-color: #f7f7f7; }

`
const promClient = promBundle({
  includePath: true,
  promClient: {
    collectDefaultMetrics: {
      prefix: 'sqnc_attachment_api_',
    },
  },
})

export default async (): Promise<Express> => {
  const app: Express = express()

  const options: SwaggerUiOptions = {
    swaggerOptions: { url: '/api-docs', oauth: { clientId: env.IDP_CLIENT_ID } },
    customCss: customCssToInject,
    customSiteTitle: API_SWAGGER_TITLE,
  }

  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  app.use(cors())
  app.use(promClient)

  app.use((req, _, next) => {
    // make sure we always have a file object on req even if this is not a multipart
    // body this is so that the attachment route can handle both JSON and multipart bodies
    req.files = []
    next()
  })

  const apiSpec = await loadApiSpec()
  app.get('/api-docs', (_req, res) => res.json(apiSpec))
  app.use('/swagger', serve, setup(undefined, options))

  RegisterRoutes(app, {
    multer: multer({
      limits: {
        fileSize: 104857600,
      },
    }),
  })

  app.use(errorHandler)

  return app
}
