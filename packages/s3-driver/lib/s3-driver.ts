import S3, {
  DeleteObjectRequest,
  GetObjectRequest,
  HeadObjectRequest,
  PutObjectRequest,
} from 'aws-sdk/clients/s3';
import { AWSError } from 'aws-sdk/lib/error';
import { PromiseResult } from 'aws-sdk/lib/request';
import { PassThrough, Stream } from 'stream';
import {
  Driver,
  DriverName,
  FileNotFoundError,
  PutResult,
  S3DiskConfig,
  toStream,
  UnauthenticatedError,
} from '@file-storage/common';

export class S3Driver extends Driver {
  private bucketName: string;
  private publicUrl?: string;
  readonly s3Instance: S3;
  static readonly driverName = DriverName.S3;

  constructor(config: S3DiskConfig) {
    super(config);
    const { bucketName, publicUrl, ...clientConfig } = config;
    if (!bucketName) {
      throw new Error('Bucket name is required');
    }
    this.bucketName = bucketName;
    this.publicUrl = publicUrl;
    this.s3Instance = new S3(clientConfig);
  }

  protected errorHandler(error: any) {
    switch (error.code) {
      case 'CredentialsError':
        throw new UnauthenticatedError(error.message);

      case 'NotFound':
        throw new FileNotFoundError(error.message);

      default:
        throw error;
    }
  }

  url(path: string): string {
    return this.publicUrl
      ? `${this.publicUrl}/${path}`
      : `https://${this.bucketName}.s3.amazonaws.com/${path}`;
  }

  exists(path: string) {
    const headObjectParams: HeadObjectRequest = {
      Key: path,
      Bucket: this.bucketName,
    };
    return this.s3Instance
      .headObject(headObjectParams)
      .promise()
      .then(
        () => true,
        () => false,
      );
  }

  async size(path: string): Promise<number> {
    const headObjectRequest: HeadObjectRequest = {
      Key: path,
      Bucket: this.bucketName,
    };
    const data = await this.s3Instance.headObject(headObjectRequest).promise();
    return data.ContentLength;
  }

  async lastModified(path: string): Promise<number> {
    const headObjectRequest: HeadObjectRequest = {
      Key: path,
      Bucket: this.bucketName,
    };
    const data = await this.s3Instance.headObject(headObjectRequest).promise();
    return data.LastModified.getTime();
  }

  /**
   * Upload to S3.
   */
  put(
    data: Stream | PassThrough | Buffer,
    Key: string,
    params?: Partial<PutResult & PutObjectRequest>,
  ) {
    const Body = toStream(data);
    const putParams: PutObjectRequest = {
      Bucket: this.bucketName,
      Key,
      Body,
      ACL: 'public-read',
      ...(typeof params !== 'undefined' && params),
    };

    // Make sure that Body is always have `read` function
    // https://github.com/aws/aws-sdk-js/issues/2100#issuecomment-398534493
    if (!(Body instanceof PassThrough)) {
      const passThrough = new PassThrough();
      Body.pipe(passThrough);
      putParams.Body = passThrough;
    }

    return this.s3Instance
      .upload(putParams)
      .promise()
      .then((result) => ({
        success: true,
        message: 'Uploading success!',
        ...result,
      }));
  }

  /**
   * Get a file from s3 bucket.
   */
  async get(Key: string): Promise<Stream> {
    const getObjectParams: GetObjectRequest = {
      Key,
      Bucket: this.bucketName,
    };

    await this.s3Instance.headObject(getObjectParams).promise();
    return this.s3Instance.getObject(getObjectParams).createReadStream();
  }

  /**
   * Delete a file from s3 bucket.
   */
  delete(Key: string): Promise<boolean> {
    const deleteParams: DeleteObjectRequest = {
      Bucket: this.bucketName,
      Key,
    };
    return new Promise<boolean>((resolve, reject) => {
      this.s3Instance.deleteObject(deleteParams, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create bucket for testing purpose.
   */
  async setupMockS3(
    Bucket: string,
  ): Promise<S3.Bucket | PromiseResult<S3.CreateBucketOutput, AWSError>> {
    if (this.s3Instance.endpoint.href !== 'http://localhost:4566/') {
      throw new Error('Supported only for testing');
    }
    const listBucketsResult = await this.s3Instance.listBuckets().promise();
    const existingBucket = listBucketsResult.Buckets.find((bucket) => bucket.Name === Bucket);

    if (existingBucket) {
      return existingBucket;
    }

    return this.s3Instance
      .createBucket({
        Bucket,
      })
      .promise();
  }

  makeDir(dir: string): Promise<string> {
    const putParams: PutObjectRequest = {
      Bucket: this.bucketName,
      Key: dir.replace(/\/$|$/, '/'),
    };

    return this.s3Instance
      .putObject(putParams)
      .promise()
      .then(() => dir);
  }

  async removeDir(dir: string): Promise<string> {
    const deleteParams: DeleteObjectRequest = {
      Bucket: this.bucketName,
      Key: dir.replace(/\/$|$/, '/'),
    };

    await this.s3Instance.deleteObject(deleteParams).promise();

    return dir;
  }
}
