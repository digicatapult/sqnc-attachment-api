import 'express'

import { TsoaExpressUser } from '@digicatapult/tsoa-oauth-express'

declare global {
  namespace Express {
    interface Request {
      user: TsoaExpressUser
    }
  }
}
