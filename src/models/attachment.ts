import { z } from 'zod'
import { UUID } from './strings.js'

/**
 * File or JSON attachment
 * @example [{
 *   "id": "string",
 *   "filename": "string",
 *   "size": 1024,
 *   "createdAt": "2023-03-16T13:18:42.357Z"
 * }]
 */
export interface Attachment {
  /**
   * uuid generated using knex
   */
  id: UUID
  /**
   * for json files name will be 'json'
   */
  filename: string | 'json' | null
  size: number | null
  createdAt: Date
}

export const internalAttachmentCreateBodyParser = z.object({
  integrity_hash: z.string(),
  ownerAddress: z.string(),
})
export type InternalAttachmentCreateBody = z.infer<typeof internalAttachmentCreateBodyParser>
