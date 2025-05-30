import { container } from 'tsyringe'
import Database from '../../src/lib/db/index.js'
import { bobAddress, notSelfAddress, selfAddress } from '../helper/mock.js'

export const parametersAttachmentId = 'a789ad47-91c3-446e-90f9-a7c9b233eaf8'
export const parametersAttachmentId2 = 'a789ad47-91c3-446e-90f9-a7c9b233eaff'
export const parametersAttachmentId4 = '5b7d7ee7-5c86-4de0-a1de-9470b7223d92'
export const nonExistentAttachmentId = '5b7d7ee7-5c86-4de0-a1de-9470b7223d98'

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
  await db.insert('attachment', {
    id: parametersAttachmentId4,
    integrity_hash: 'QmX5g1GwdB87mDoBTpTgfuWD2VKk8SpMj5WMFFGhhFacHN',
    owner: bobAddress,
    filename: null,
    size: null,
    created_at: new Date('2021-05-07T15:48:48.774Z'),
    updated_at: new Date('2021-05-07T15:48:48.774Z'),
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
