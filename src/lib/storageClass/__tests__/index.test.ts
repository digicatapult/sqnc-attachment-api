import { describe, it } from 'mocha'

import { expect } from 'chai'
import sinon from 'sinon'
import StorageClass from '../index'
import { container } from 'tsyringe'
import { Readable } from 'stream'
import { resetContainer } from '../../../ioc'
import { NotFound } from '../../error-handler'

describe('StorageClass', () => {
  let storageClass: StorageClass
  let listBucketsStub: sinon.SinonStub
  let createBucketStub: sinon.SinonStub
  let addFileFromBufferStub: sinon.SinonStub
  let listFilesStub: sinon.SinonStub
  let getFileAsStreamStub: sinon.SinonStub
  // should I be using a mockEnv here or is it fine if I just use normal env?

  beforeEach(() => {
    resetContainer()
    sinon.restore()
    storageClass = container.resolve(StorageClass)
    listBucketsStub = sinon.stub(storageClass['storage'], 'listBuckets')
    createBucketStub = sinon.stub(storageClass['storage'], 'createBucket')
    addFileFromBufferStub = sinon.stub(storageClass['storage'], 'addFileFromBuffer')
    listFilesStub = sinon.stub(storageClass['storage'], 'listFiles')
    getFileAsStreamStub = sinon.stub(storageClass['storage'], 'getFileAsStream')
  })

  describe('listBuckets', () => {
    it('should successfully list buckets', async () => {
      const mockBuckets = {
        value: ['bucket1', 'bucket2'],
        error: null,
      }
      listBucketsStub.resolves(mockBuckets)

      const result = await storageClass.listBuckets()
      expect(result).to.deep.equal(mockBuckets)
    })

    it('should handle error when listing buckets fails', async () => {
      const mockError = {
        value: null,
        error: new Error('Failed to list buckets'),
      }
      listBucketsStub.resolves(mockError)

      const result = await storageClass.listBuckets()
      expect(result).to.deep.equal(mockError)
    })
  })

  describe('createBucketIfDoesNotExist', () => {
    it('should create bucket if it does not exist', async () => {
      const mockBuckets = {
        value: ['other-bucket'],
        error: null,
      }
      const mockCreateResult = {
        error: null,
      }
      listBucketsStub.resolves(mockBuckets)
      createBucketStub.resolves(mockCreateResult)

      await storageClass.createBucketIfDoesNotExist()
      expect(createBucketStub.calledWith('test')).to.be.equal(true)
    })

    it('should throw error when listing buckets fails', async () => {
      const mockError = {
        value: null,
        error: new Error('Failed to list buckets'),
      }
      listBucketsStub.resolves(mockError)

      try {
        await storageClass.createBucketIfDoesNotExist()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.equal('Failed to list buckets')
      }
    })

    it('should throw error when creating bucket fails', async () => {
      const mockBuckets = {
        value: ['other-bucket'],
        error: null,
      }
      const mockCreateError = {
        error: new Error('Failed to create bucket'),
      }
      listBucketsStub.resolves(mockBuckets)
      createBucketStub.resolves(mockCreateError)

      try {
        await storageClass.createBucketIfDoesNotExist()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.equal('Failed to create bucket')
      }
    })
  })

  describe('uploadFile', () => {
    const mockFileBuffer = Buffer.from('test content')
    const mockFilename = 'test.txt'

    it('should successfully upload file', async () => {
      const mockUploadResult = {
        error: null,
        value: 'test.txt',
      }
      addFileFromBufferStub.resolves(mockUploadResult)
      createBucketStub.resolves({
        error: null,
      })
      listBucketsStub.resolves({
        error: null,
        value: ['test'],
      })

      await storageClass.uploadFile(mockFileBuffer, mockFilename)
      expect(addFileFromBufferStub.callCount).to.be.equal(1)
      expect(
        addFileFromBufferStub.calledWith({
          buffer: mockFileBuffer,
          targetPath: mockFilename,
          bucketName: 'test',
        })
      ).to.be.equal(true)
    })

    it('should throw error when upload fails', async () => {
      const mockUploadError = {
        error: new Error('Failed to upload file'),
      }
      addFileFromBufferStub.resolves(mockUploadError)
      createBucketStub.resolves({
        error: null,
      })
      listBucketsStub.resolves({
        error: null,
        value: ['test'],
      })

      try {
        await storageClass.uploadFile(mockFileBuffer, mockFilename)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.equal('Failed to upload file')
      }
    })

    it('should create bucket if it does not exist before uploading', async () => {
      const mockBuckets = {
        value: ['other-bucket'],
        error: null,
      }
      const mockCreateResult = {
        error: null,
      }
      const mockUploadResult = {
        error: null,
      }
      listBucketsStub.resolves(mockBuckets)
      createBucketStub.resolves(mockCreateResult)
      addFileFromBufferStub.resolves(mockUploadResult)

      await storageClass.uploadFile(mockFileBuffer, mockFilename)
      expect(createBucketStub.calledWith('test')).to.be.equal(true)
      expect(
        addFileFromBufferStub.calledWith({
          buffer: mockFileBuffer,
          targetPath: mockFilename,
          bucketName: 'test',
        })
      ).to.be.equal(true)
    })
  })

  describe('retrieveFileBuffer', () => {
    const mockFilename = 'test.txt'
    const mockFileContent = 'test content'
    const mockBuffer = Buffer.from(mockFileContent)

    it('should successfully retrieve file buffer', async () => {
      listFilesStub.resolves({
        error: null,
        value: [mockFilename],
      })

      const mockStream = new Readable()
      mockStream.push(mockFileContent)
      mockStream.push(null)

      getFileAsStreamStub.resolves({
        error: null,
        value: mockStream,
      })

      const result = await storageClass.retrieveFileBuffer(mockFilename)
      expect(result).to.deep.equal(mockBuffer)
      expect(getFileAsStreamStub.calledWith('test', mockFilename)).to.be.equal(true)
    })

    it('should throw error when getFileAsStream fails', async () => {
      listFilesStub.resolves({
        error: null,
        value: [mockFilename],
      })

      getFileAsStreamStub.resolves({
        error: new NotFound('Failed to retrieve file'),
        value: null,
      })

      try {
        await storageClass.retrieveFileBuffer(mockFilename)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.equal('Failed to retrieve file with filename: test.txt not found')
      }
    })

    it('should throw error when stream conversion fails', async () => {
      listFilesStub.resolves({
        error: null,
        value: [mockFilename],
      })

      const errorStream = new Readable()
      errorStream._read = () => {
        errorStream.emit('error', new Error('Stream error'))
      }
      getFileAsStreamStub.resolves({
        error: null,
        value: errorStream,
      })

      try {
        await storageClass.retrieveFileBuffer(mockFilename)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.equal('Stream read failed: Stream error')
      }
    })
  })
})
