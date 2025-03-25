import { z } from 'zod'
import { UUID } from './strings.js'

/**
 * File attachment
 * @example {
 *   "id": "string",
 *   "filename": "string",
 *   "size": 1024,
 *   "integrityHash": "string",
 *   "owner": "string",
 *   "createdAt": "2023-03-16T13:18:42.357Z"
 * }
 */
export interface Attachment {
  id: UUID
  filename: string | 'json' | null
  size: number | null
  integrityHash: string
  owner: string
  createdAt: Date
}

export const internalAttachmentCreateBodyParser = z.object({
  integrityHash: z.string(),
  ownerAddress: z.string(),
})
export type InternalAttachmentCreateBody = z.infer<typeof internalAttachmentCreateBodyParser>
