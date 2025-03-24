import {
  Security,
  Tags,
  UploadedFile,
  Request,
  Controller,
  Get,
  Route,
  Path,
  Post,
  Response,
  SuccessResponse,
  Produces,
  ValidateError,
  Query,
} from 'tsoa'
import { Logger } from 'pino'
import express from 'express'
import { Readable } from 'node:stream'

import { logger } from '../../../lib/logger.js'
import Database from '../../../lib/db/index.js'
import { internalAttachmentCreateBodyParser, type Attachment } from '../../../models/attachment.js'
import { BadRequest, NotFound, UnknownError } from '../../../lib/error-handler/index.js'
import type { UUID, DATE } from '../../../models/strings.js'
import Ipfs from '../../../lib/ipfs.js'
import env from '../../../env.js'
import { parseDateParam } from '../../../lib/utils/queryParams.js'
import { AttachmentRow, Where } from '../../../lib/db/types.js'
import Identity from '../../../lib/identity.js'
import { getAuthorization } from '../../../lib/utils/shared.js'
import { injectable } from 'tsyringe'

const parseAccept = (acceptHeader: string) =>
  acceptHeader
    .split(',')
    .map((acceptElement) => {
      const trimmed = acceptElement.trim()
      const [mimeType, quality = '1'] = trimmed.split(';q=')
      return { mimeType, quality: parseFloat(quality) }
    })
    .sort((a, b) => {
      if (a.quality !== b.quality) {
        return b.quality - a.quality
      }
      const [aType, aSubtype] = a.mimeType.split('/')
      const [bType, bSubtype] = b.mimeType.split('/')
      if (aType === '*' && bType !== '*') {
        return 1
      }
      if (aType !== '*' && bType === '*') {
        return -1
      }
      if (aSubtype === '*' && bSubtype !== '*') {
        return 1
      }
      if (aSubtype !== '*' && bSubtype === '*') {
        return -1
      }
      return 0
    })
    .map(({ mimeType }) => mimeType)

@injectable()
@Route('v1/attachment')
@Tags('attachment')
@Security('oauth2')
@Security('internal')
export class AttachmentController extends Controller {
  log: Logger
  ipfs: Ipfs = new Ipfs({
    host: env.IPFS_HOST,
    port: env.IPFS_PORT,
    logger,
  })

  //keep a log of looked up identities for this request to make sure they are consistently applied
  memoisedIdentities: Map<string, string> = new Map()

  constructor(
    private db: Database,
    private identity: Identity
  ) {
    super()
    this.log = logger.child({ controller: '/attachment' })
  }

  octetResponse(buffer: Buffer, name: string): Readable {
    // default to octet-stream or allow error middleware to handle
    this.setHeader('access-control-expose-headers', 'content-disposition')
    this.setHeader('content-disposition', `attachment; filename="${name}"`)
    this.setHeader('content-type', 'application/octet-stream')
    this.setHeader('maxAge', `${365 * 24 * 60 * 60 * 1000}`)
    this.setHeader('immutable', 'true')

    return Readable.from(buffer)
  }

  @Get('/')
  @SuccessResponse(200, 'returns all attachments')
  public async get(
    @Request() req: express.Request,
    @Query() updated_since?: DATE,
    @Query() owner?: string,
    @Query() integrityHash?: string,
    @Query() id?: UUID[]
  ): Promise<Attachment[]> {
    const query: Where<'attachment'> = [
      updated_since && (['updated_at', '>', parseDateParam(updated_since)] as const),
      integrityHash && (['integrity_hash', '=', integrityHash] as const),
      id && (['id', 'IN', id] as const),
    ].filter((x) => !!x)

    if (owner) {
      try {
        const identity = await this.identity.getMemberByAlias(owner, getAuthorization(req))
        this.rememberThem(identity)
        query.push(['owner', '=', identity.address] as const)
      } catch (err) {
        if (err instanceof NotFound) {
          throw new BadRequest(`Invalid identity ${owner}`)
        }
      }
    }

    this.log.debug('retrieving attachments with search: %o', { updated_since, owner, integrityHash })

    const attachments = await this.db.get('attachment', query)

    return this.transformAttachments(req, attachments)
  }

  @Post('/')
  @SuccessResponse(201, 'attachment has been created')
  @Response<ValidateError>(422, 'Validation Failed')
  public async create(
    @Request() req: express.Request,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<Attachment> {
    if (!file && req.user.securityName === 'internal') {
      return this.createInternal(req)
    }

    this.log.debug(`creating an attachment filename: ${file?.originalname || 'json'}`)

    if (!req.body && !file) throw new BadRequest('nothing to upload')

    const filename = file ? file.originalname : 'json'
    const fileBuffer = file?.buffer ? Buffer.from(file?.buffer) : Buffer.from(JSON.stringify(req.body))
    const fileBlob = new Blob([fileBuffer])

    const [integrityHash, self] = await Promise.all([
      this.ipfs.addFile.apply(this.ipfs, [{ blob: fileBlob, filename }]),
      this.identity.getMemberBySelf.apply(this.identity, [getAuthorization(req)]),
    ])

    this.rememberThem(self)
    const [res] = await this.db.insert('attachment', {
      filename,
      owner: self.address,
      integrity_hash: integrityHash,
      size: fileBlob.size,
    })

    return this.transformAttachment(req, res)
  }

  private async createInternal(req: express.Request): Promise<Attachment> {
    this.log.debug('creating an internal attachment')
    this.log.trace('attachment create body %j', req.body)

    const { ownerAddress, integrity_hash: integrityHash } = this.parseInternalCreateBody(req.body)

    this.log.debug(`creating an internal attachment with hash: ${integrityHash} for owner: ${ownerAddress}`)

    const [res] = await this.db.insert('attachment', {
      owner: ownerAddress,
      integrity_hash: integrityHash,
      filename: null,
      size: null,
    })

    return this.transformAttachment(req, res)
  }

  private parseInternalCreateBody(body: unknown) {
    try {
      return internalAttachmentCreateBodyParser.parse(body)
    } catch (err) {
      this.log.warn('Invalid body for internal attachment creation: %s', err instanceof Error ? err.message : 'unknown')
      throw new BadRequest('Invalid body for internal attachment creation')
    }
  }

  @Get('/{id}')
  @Response<NotFound>(404)
  @Response<BadRequest>(400)
  @Produces('application/json')
  @Produces('application/octet-stream')
  @SuccessResponse(200)
  public async getById(@Request() req: express.Request, @Path() id: UUID): Promise<unknown | Readable> {
    this.log.debug(`attempting to retrieve ${id} attachment`)
    const [attachment] = await this.db.get('attachment', { id })
    if (!attachment) throw new NotFound('attachment')

    const { blob, filename: ipfsFilename } = await this.ipfs.getFile(attachment.integrity_hash)
    const blobBuffer = Buffer.from(await blob.arrayBuffer())

    let { filename, size } = attachment
    if (size === null || filename === null) {
      try {
        await this.db.update('attachment', { id }, { filename: ipfsFilename, size: blob.size })
        filename = ipfsFilename
        size = blob.size
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown'
        this.log.warn('Error updating attachment size: %s', message)
      }
    }

    const orderedAccept = parseAccept(req.headers.accept || '*/*')
    if (filename === 'json') {
      for (const mimeType of orderedAccept) {
        if (mimeType === 'application/json' || mimeType === 'application/*' || mimeType === '*/*') {
          try {
            const json = JSON.parse(blobBuffer.toString())
            return json
          } catch (err) {
            this.log.warn('Unable to parse json file for attachment %s', id)
            this.log.debug('Parse error: %s', err instanceof Error ? err.message : 'unknown')
            return this.octetResponse(blobBuffer, filename)
          }
        }
        if (mimeType === 'application/octet-stream') {
          return this.octetResponse(blobBuffer, filename)
        }
      }
    }
    return this.octetResponse(blobBuffer, filename || ipfsFilename)
  }

  private async transformAttachments(req: express.Request, result: AttachmentRow[]) {
    return Promise.all(result.map((a) => this.transformAttachment(req, a)))
  }

  private async transformAttachment(req: express.Request, result: AttachmentRow) {
    const { owner: ownerAddr, id, filename, created_at: createdAt, integrity_hash: integrityHash, size } = result
    if (this.memoisedIdentities.has(ownerAddr)) {
      return { owner: this.memoisedIdentities.get(ownerAddr), id, filename, size, createdAt, integrityHash }
    }

    try {
      const identity = await this.identity.getMemberByAddress(ownerAddr, getAuthorization(req))
      this.rememberThem(identity)
      return { owner: identity.alias, id, filename, size, createdAt, integrityHash }
    } catch (err) {
      if (err instanceof NotFound) {
        this.log.warn('Invalid owner detected in db: %s', ownerAddr)
      }
      throw new UnknownError()
    }
  }

  private rememberThem({ alias, address }: { alias: string; address: string }) {
    this.memoisedIdentities.set(alias, address)
    this.memoisedIdentities.set(address, alias)
  }
}
