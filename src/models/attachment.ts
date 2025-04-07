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

export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * UUID format identifier
 * @example 282439cd-ebc8-420e-bfbb-0de8fb3149ed
 * @pattern ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
 */
export type AttachmentId = string

/**
 * File integrity hash
 * @example QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN
 * @pattern ^[a-zA-Z0-9]+$
 */
export type AttachmentHash = string

/**
 * Either an attachment UUID or an file integrity hash
 */
export type AttachmentIdOrHash = AttachmentId | AttachmentHash
