import moment from 'moment'

import { BadRequest } from '../error-handler/index.js'
import { DATE } from '../../models/strings.js'

export const parseDateParam = (dateStr: DATE) => {
  const parsed = moment(dateStr, moment.ISO_8601, true)
  if (!parsed.isValid()) {
    throw new BadRequest(`${dateStr} is not a valid date`)
  }
  return parsed.toDate()
}
