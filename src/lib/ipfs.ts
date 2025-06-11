import type { Logger } from 'pino'
import { singleton } from 'tsyringe'
import { z } from 'zod'

import { serviceState } from './service-watcher/statusPoll.js'
import { HttpResponse } from './error-handler/index.js'
import { importer } from 'ipfs-unixfs-importer'
import { MemoryBlockstore } from 'blockstore-core'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import all from 'it-all'

interface FilestoreResponse {
  Name: string
  Hash: string
  Size: string
}

export interface MetadataFile {
  blob: Blob
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

@singleton()
export default class Ipfs {
  private addUrl: string
  private dirUrl: (dirHash: string) => string
  private fileUrl: (fileHash: string) => string
  private logger: Logger
  private versionURL: string
  private peersURL: string

  constructor({ host, port, logger }: { host: string; port: number; logger: Logger }) {
    this.addUrl = `http://${host}:${port}/api/v0/add?cid-version=0&wrap-with-directory=true`
    this.dirUrl = (dirHash) => `http://${host}:${port}/api/v0/ls?arg=${dirHash}`
    this.fileUrl = (fileHash) => `http://${host}:${port}/api/v0/cat?arg=${fileHash}`

    this.logger = logger.child({ module: 'ipfs' })
    this.versionURL = `http://${host}:${port}/api/v0/version`
    this.peersURL = `http://${host}:${port}/api/v0/swarm/peers`
  }

  async addFile({ blob, filename }: MetadataFile): Promise<string> {
    this.logger.debug('Uploading file %s', filename)
    const form = new FormData()
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
    return hash
  }

  async getFile(hash: string): Promise<MetadataFile> {
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

    return { blob: await fileRes.blob(), filename }
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
  async cidHashFromBuffer(buffer: Buffer, filename: string) {
    const file = {
      content: buffer,
      path: filename, // need filename to produce correct cid
    }
    const blockstore = new MemoryBlockstore()

    const entries = await all(
      importer([file], blockstore, {
        cidVersion: 0,
        rawLeaves: false,
        wrapWithDirectory: true,
        chunker: fixedSize({ chunkSize: 262144 }), // 256 KB chunks
      })
    )
    const root = entries.at(-1)
    if (!root) {
      throw new Error('No root found')
    }
    return root.cid.toString()
  }
}

const logStatusError = (logger: Logger, details: unknown) => {
  if (details instanceof Error) {
    logger.error('Error getting status from IPFS node. Message: %s', details.message)
    logger.debug('Error getting status from IPFS node. Stack: %j', details.stack)
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
