import fs from 'fs';
import Storage from '@file-storage/core';
import { DriverName, FileNotFoundError, GCSDiskConfig, getRootCwd } from '@file-storage/common';
import { GoogleCloudStorageDriver } from './gcs-driver.js';

describe('Google Cloud Storage', () => {
  const bucketName1 = 'my_gcs_bucket';

  beforeAll(async () => {
    Storage.config<GCSDiskConfig>({
      diskConfigs: [
        {
          driver: DriverName.GCS,
          name: 'my_gcs',
          bucketName: bucketName1,
          apiEndpoint: 'http://localhost:4443',
          projectId: 'test',
        },
      ],
    });

    await Storage.disk<GoogleCloudStorageDriver>('my_gcs').createBucket(bucketName1);
  });

  test('default disk is my_gcs', () => {
    expect(Storage.name).toEqual('my_gcs');
  });

  test('upload image from URI to GCS', () => {
    return expect(
      Storage.disk('my_gcs').uploadImageFromExternalUri(
        'https://4.img-dpreview.com/files/p/E~TS590x0~articles/3925134721/0266554465.jpeg',
        'test_upload/test_image_from_uri.jpeg',
      ),
    ).resolves.toMatchObject({
      success: true,
      message: 'Uploading success!',
    });
  });

  test('upload image to gcs success', () => {
    const fileReadStream = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    return expect(Storage.put(fileReadStream, 'test_upload/bird2.jpeg')).resolves.toMatchObject({
      success: true,
      message: 'Uploading success!',
    });
  });

  test('upload GCS large image will upload to many formats', () => {
    const imageFileStream = fs.createReadStream(
      getRootCwd() + '/test/support/images/photo-1000x750.jpeg',
    );
    return expect(
      Storage.put(imageFileStream, 'my-photo/photo-1000x750.jpeg'),
    ).resolves.toMatchSnapshot();
  });

  test('download image from GCS', async () => {
    const fileReadStream = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    await Storage.put(fileReadStream, 'test_upload/bird2.jpeg');
    return expect(Storage.get('test_upload/bird2.jpeg')).resolves.toBeTruthy();
  });

  test('download not exists image from GCS error', async () => {
    return expect(Storage.disk('my_gcs').get('not-exists.jpeg')).rejects.toThrowError(
      FileNotFoundError,
    );
  });

  test('File is exists', async () => {
    const fileReadStream = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    await Storage.disk('my_gcs').put(fileReadStream, 'bird-images/bird.jpeg');

    return expect(Storage.exists('bird-images/bird.jpeg')).resolves.toEqual(true);
  });

  test('file is not exists', async () => {
    const exist = await Storage.disk('my_gcs').exists('not-exists.jpeg');
    const exist2 = await Storage.exists('not-exists.jpeg');
    expect(exist).toEqual(false);
    expect(exist2).toEqual(false);
  });

  test('get file size', async () => {
    const fileReadStream2 = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    await Storage.disk('my_gcs').put(fileReadStream2, 'bird-images/bird-size.jpeg');

    return expect(Storage.size('bird-images/bird-size.jpeg')).resolves.toEqual(56199);
  });

  test('last modified', async () => {
    const fileReadStream = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    await Storage.disk('my_gcs').put(fileReadStream, 'bird-images/bird.jpeg');
    const lastMod = await Storage.lastModified('bird-images/bird.jpeg');
    const lastMod2 = await Storage.lastModified('bird-images/bird.jpeg');
    expect(typeof lastMod).toBe('number');
    expect(typeof lastMod2).toBe('number');
  });

  test('copy file', async () => {
    const fileReadStream = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    const putResult = await Storage.put(fileReadStream, 'bird-images/bird.jpeg');
    await Storage.copy(putResult.path, 'photos/bird-copy.jpeg');

    const size = await Storage.size('photos/bird-copy.jpeg');
    expect(typeof size).toBe('number');
  });

  test('move file', async () => {
    const fileReadStream = fs.createReadStream(getRootCwd() + '/test/support/images/bird.jpeg');
    const putResult = await Storage.put(fileReadStream, 'bird-images/bird.jpeg');
    await Storage.move(putResult.path, 'photos/new-path.jpeg');

    const size = await Storage.size('photos/new-path.jpeg');
    expect(typeof size).toBe('number');

    return expect(Storage.size('bird-images/bird.jpeg')).rejects.toThrowError(FileNotFoundError);
  });
});
