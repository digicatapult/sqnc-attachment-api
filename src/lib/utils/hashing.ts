import { createHash } from 'crypto'

// generate hash to use as a file name for S3/Azure storage
export function sha256HashFromBuffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}
