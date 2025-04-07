import { container } from 'tsyringe'
import Database from '../../src/lib/db/index.js'
import { notSelfAddress, selfAddress } from '../helper/mock.js'

export const parametersAttachmentId = 'a789ad47-91c3-446e-90f9-a7c9b233eaf8'
export const parametersAttachmentId2 = 'a789ad47-91c3-446e-90f9-a7c9b233eaff'
export const exampleDate = '2023-01-01T00:00:00.000Z'
export const exampleDate2 = '2022-01-01T00:00:00.000Z'

export const cleanup = async () => {
  const db = container.resolve(Database)
  await db.delete('attachment', {})
}

export const attachmentSeed = async () => {
  const db = container.resolve(Database)
  await cleanup()

  await db.insert('attachment', {
    id: parametersAttachmentId,
    filename: 'test.txt',
    integrity_hash: 'hash1',
    owner: selfAddress,
    size: 42,
    created_at: new Date(exampleDate),
    updated_at: new Date(exampleDate),
  })

  await db.insert('attachment', {
    id: parametersAttachmentId2,
    filename: 'test2.txt',
    integrity_hash: 'hash2',
    owner: notSelfAddress,
    size: 42,
    created_at: new Date(exampleDate2),
    updated_at: new Date(exampleDate2),
  })
}

export const additionalAttachmentSeed = async () => {
  const db = container.resolve(Database)

  await db.insert('attachment', {
    id: parametersAttachmentId,
    filename: 'test4.txt',
    integrity_hash: 'hash1',
    owner: selfAddress,
    size: 42,
    created_at: new Date(exampleDate),
    updated_at: new Date(exampleDate),
  })
}
