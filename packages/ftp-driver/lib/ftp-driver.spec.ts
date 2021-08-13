import fs from 'fs';
import Storage from '@file-storage/core';
import { DriverName, getRootCwd } from '@file-storage/common';

describe('FTP Disk test', () => {
  beforeAll(() => {
    Storage.config({
      diskConfigs: [
        {
          driver: DriverName.FTP,
          name: 'sammy',
          isDefault: true,
          root: '/upload',
          accessOptions: {
            host: '127.0.0.1',
            user: 'usertest',
            password: 'P@ssw0rd',
          },
        },
      ],
    });
  });

  const fileReadStream = fs.createReadStream(
    getRootCwd() + '/test/support/images/0266554465-1528092757338.jpeg',
  );

  test('Default disk is sammy', () => {
    expect(Storage.defaultDisk.name).toEqual('sammy');
    expect(Storage.name).toEqual('sammy');
  });

  test('Upload image to ftp', async () => {
    return expect(Storage.disk('sammy').put(fileReadStream, 'bird.jpeg')).resolves.toMatchObject({
      code: 226,
      message: '226 Transfer complete.',
    });
  });

  test('Upload using Storage facade', () => {
    return expect(Storage.put(fileReadStream, 'bird.jpeg')).resolves.toMatchObject({
      code: 226,
      message: '226 Transfer complete.',
    });
  });

  test('Download image from ftp', async () => {
    await Storage.disk('sammy').put(fileReadStream, 'test_upload/bird.jpeg');

    return expect(Storage.disk('sammy').get('test_upload/bird.jpeg')).resolves.toBeTruthy();
  });

  test('Delete image from ftp', async () => {
    await Storage.disk('sammy').put(fileReadStream, 'test_upload/bird.jpeg');

    return expect(Storage.disk('sammy').delete('test_upload/bird.jpeg')).resolves.toMatchObject({
      code: 250,
      message: '250 Delete operation successful.',
    });
  });

  test('File is exists', async () => {
    await Storage.disk('sammy').put(fileReadStream, 'test_upload/bird.jpeg');

    return expect(Storage.exists('test_upload/bird.jpeg')).resolves.toEqual(true);
  });

  test('File is not exists', async () => {
    return expect(Storage.disk('sammy').exists('not-exists.jpeg')).resolves.toEqual(false);
  });

  test('Get file size', async () => {
    const fileReadStream2 = fs.createReadStream(
      getRootCwd() + '/test/support/images/0266554465-1528092757338.jpeg',
    );
    await Storage.disk('sammy').put(fileReadStream2, 'bird-images/bird.jpeg');

    return expect(Storage.defaultDisk.size('bird-images/bird.jpeg')).resolves.toEqual(56199);
  });

  test('Last modified', async () => {
    await Storage.disk('sammy').put(fileReadStream, 'bird-images/bird2.jpeg');
    const lastMod = await Storage.defaultDisk.lastModified('bird-images/bird2.jpeg');
    expect(typeof lastMod).toBe('number');
  });
});
