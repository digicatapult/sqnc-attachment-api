import type { Logger } from 'pino'
import { inject, injectable } from 'tsyringe'
import { z } from 'zod'

import { serviceState } from './service-watcher/statusPoll.js'
import { HttpResponse } from './error-handler/index.js'
import { Env, EnvToken, type IPFSEnv } from '../env.js'
import { LoggerToken } from './logger.js'
import { HashType } from './db/types.js'

interface FilestoreResponse {
  Name: string
  Hash: string
  Size: string
}

export interface MetadataFile {
  buffer: Buffer
  filename: string
}

const dirListValidator = z.object({
  Objects: z.array(
    z.object({
      Links: z.array(
        z.object({
          Hash: z.string(),
          Name: z.string(),
        })
      ),
    })
  ),
})

const versionValidator = z.object({
  Version: z.string(),
})

const peersValidator = z.object({
  Peers: z
    .array(
      z.object({
        Addr: z.string(),
        Peer: z.string(),
      })
    )
    .nullable(),
})
@injectable()
export default class Ipfs {
  private addUrl: string
  private dirUrl: (dirHash: string) => string
  private fileUrl: (fileHash: string) => string
  private versionURL: string
  private peersURL: string

  constructor(
    @inject(EnvToken) private env: IPFSEnv,
    @inject(LoggerToken) private logger: Logger
  ) {
    this.addUrl = `http://${this.env.IPFS_HOST}:${this.env.IPFS_PORT}/api/v0/add?cid-version=0&wrap-with-directory=true`
    this.dirUrl = (dirHash) => `http://${this.env.IPFS_HOST}:${this.env.IPFS_PORT}/api/v0/ls?arg=${dirHash}`
    this.fileUrl = (fileHash) => `http://${this.env.IPFS_HOST}:${this.env.IPFS_PORT}/api/v0/cat?arg=${fileHash}`

    this.versionURL = `http://${this.env.IPFS_HOST}:${this.env.IPFS_PORT}/api/v0/version`
    this.peersURL = `http://${this.env.IPFS_HOST}:${this.env.IPFS_PORT}/api/v0/swarm/peers`
    this.logger.child({ module: 'ipfs' })
  }

  async addFile({ buffer, filename }: MetadataFile): Promise<{ integrityHash: string; hashType: HashType }> {
    this.logger.debug('Uploading file %s', filename)
    const form = new FormData()
    const blob = new Blob([new Uint8Array(buffer)])

    form.append('file', blob, filename)
    const res = await fetch(this.addUrl, {
      method: 'POST',
      body: form,
    })

    const text = await res.text()

    if (!res.ok) {
      throw new HttpResponse({ code: 500, message: text })
    }

    // Build string of objects into array
    const json = text
      .split('\n')
      .filter((obj) => obj.length > 0)
      .map((obj) => JSON.parse(obj))

    const hash = findHash(json)
    this.logger.debug('Upload of file %s succeeded. Hash is %s', filename, hash)
    return { integrityHash: hash, hashType: 'cidv0' }
  }

  async getFile(hash: string) {
    const dirUrl = this.dirUrl(hash)
    const dirRes = await fetch(dirUrl, { method: 'POST' })
    if (!dirRes.ok || !dirRes.body) {
      throw new Error(`Error fetching directory from IPFS (${dirRes.status}): ${await dirRes.text()}`)
    }
    // Parse stream of dir data to get the file hash
    const data = dirListValidator.parse(await dirRes.json())
    const link = data?.Objects?.[0]?.Links?.[0]

    if (!link) {
      throw new Error(`Error parsing directory from IPFS (${dirRes.status}): ${await dirRes.text()}`)
    }
    const fileHash = link.Hash
    const filename = link.Name

    // Return file
    const fileUrl = this.fileUrl(fileHash)
    const fileRes = await fetch(fileUrl, { method: 'POST' })
    if (!fileRes.ok) throw new Error(`Error fetching file from IPFS (${fileRes.status}): ${await fileRes.text()}`)

    const blob = await fileRes.blob()
    const buffer = Buffer.from(await blob.arrayBuffer())
    return { buffer, filename }
  }

  getStatus = async () => {
    try {
      const results = await Promise.all([
        fetch(this.versionURL, { method: 'POST' }),
        fetch(this.peersURL, { method: 'POST' }),
      ])
      if (results.some((result) => !result.ok)) {
        logStatusError(this.logger, {
          versionCheckResult: results[0].statusText,
          peersCheckResult: results[1].statusText,
        })
        return {
          status: serviceState.DOWN,
          detail: {
            message: 'Error getting status from IPFS node',
          },
        }
      }

      const [versionResultJson, peersResultJson] = await Promise.all(results.map((r) => r.json()))
      const [versionResult, peersResult] = [
        versionValidator.parse(versionResultJson),
        peersValidator.parse(peersResultJson),
      ]
      const peers = peersResult.Peers || null
      const peerCount = peers === null ? 0 : new Set(peers.map((peer) => peer.Peer)).size
      return {
        status: serviceState.UP,
        detail: {
          version: versionResult.Version,
          peerCount: peerCount,
        },
      }
    } catch (err) {
      logStatusError(this.logger, err)
      return {
        status: serviceState.DOWN,
        detail: {
          message: 'Error getting status from IPFS node',
        },
      }
    }
  }
}

const logStatusError = (logger: Logger, details: unknown) => {
  if (details instanceof Error) {
    logger.error('Error getting status from IPFS node. Message: %s', details.message)
    logger.debug('Error getting status from IPFS node. Stack: %s', details.stack ?? 'no stack')
  } else {
    logger.error('Error getting status from IPFS node: %s', JSON.stringify(details))
  }
}

const findHash = (filestoreResponse: FilestoreResponse[]) => {
  // directory has no Name
  const dir = filestoreResponse.find((r) => r.Name === '')
  if (dir && dir.Hash && dir.Size) {
    return dir.Hash
  } else {
    throw new HttpResponse({ code: 500, message: 'ipfs failed to make directory' })
  }
}

export function isIpfsEnv(env: Env): env is IPFSEnv {
  return env.STORAGE_BACKEND_MODE === 'IPFS'
}
