import { Stream } from 'stream';
import { DriverName } from './enums/driver-name.enum';
import { DiskConfig } from './types/disk-config.interface';

const request = require('request');

export abstract class Driver {
  name: DriverName | string;

  constructor({ name }: DiskConfig) {
    this.name = name;
  }

  init?: () => Promise<void>;

  /**
   * Get full url of the file
   * @param path string
   */
  abstract url(path: string): string;

  /**
   * Determine if a file exists on the disk
   */
  abstract exists(path: string): Promise<boolean>;

  /**
   * Get size of a file in bytes
   */
  abstract size(path: string): Promise<number>;

  /**
   * This methods returns the UNIX timestamp of the last time the file was modified.
   */
  abstract lastModified(path: string): Promise<number>;

  /**
   * Put to specific disk from a stream or buffer.
   *
   * @param stream stream.Stream
   * @param path string
   * @throws If file doesn't exists.
   */
  abstract put(stream: Stream, path: string): Promise<any>;

  /**
   * Get a file.
   * @param path string
   */
  abstract get(path: string): Stream | Promise<Stream>;

  /**
   * Delete a file
   *
   * @param path Path of file.
   * @throws If deleting failed.
   */
  abstract delete(path: string): Promise<any>;

  /**
   * This method will create the given directory, including any needed subdirectories.
   *
   * @throws If directory already exists.
   */
  abstract makeDir(dir: string): Promise<string>;

  /**
   * Remove given directory and all of its files.
   *
   * @throws If cannot remove.
   */
  abstract removeDir(dir: string): Promise<string>;

  /**
   * Upload image from specific URI and store it into `filename`
   *
   * @param uri URI of image
   * @param path Filename included location to store image.
   * @param ignoreHeaderContentType ignore checking content-type header.
   * @returns Promise<any>
   */
  uploadImageFromExternalUri(
    uri: string,
    path: string,
    ignoreHeaderContentType?: boolean,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      request.head(uri, async (err: any, res: any) => {
        if (err) {
          reject(err);
        }
        if (
          ignoreHeaderContentType ||
          (res && res.headers['content-type'] && res.headers['content-type'].match(/image/))
        ) {
          try {
            const data = await this.put(request(uri), path);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error('Not an image: ' + uri));
        }
      });
    });
  }
}
