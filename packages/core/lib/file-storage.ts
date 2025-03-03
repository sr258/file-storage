import { Stream } from 'stream';
import {
  DiskConfig,
  DriverName,
  Driver,
  requireDefaultModule,
  LocalDiskConfig,
  Class,
  Plugin,
  PutResult,
  getFileName,
  ImageStats,
} from '@file-storage/common';
import { BuiltInDiskConfig, StorageConfiguration } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { parse, format } from 'path';

const defaultDiskConfig: LocalDiskConfig = {
  driver: DriverName.LOCAL,
  name: 'local',
  root: 'storage',
};

let availableDisks: (DiskConfig | BuiltInDiskConfig)[] = [defaultDiskConfig];

const drivers: Class<Driver>[] = [
  requireDefaultModule('@file-storage/s3'),
  requireDefaultModule('@file-storage/ftp'),
  requireDefaultModule('@file-storage/local'),
  requireDefaultModule('@file-storage/sftp'),
  requireDefaultModule('@file-storage/gcs'),
];

const plugins: Class<Plugin>[] = [requireDefaultModule('@file-storage/image-manipulation')].filter(
  (item) => !!item,
);

function handleDiskConfigs(diskConfigs: DiskConfig[]) {
  const seen = new Set();
  availableDisks = [];

  const hasDuplicatesName = () =>
    diskConfigs.some((diskConfig) => seen.size === seen.add(diskConfig.name).size);

  if (hasDuplicatesName()) {
    throw new Error('Duplicated disk name.');
  }

  if (diskConfigs.length === 0) {
    availableDisks.push(defaultDiskConfig);
  } else {
    availableDisks.push(...diskConfigs);
  }
}

/**
 * @deprecated
 */
function addCustomDriver(customDrivers: Class<Driver>[] = []) {
  if (customDrivers.length > 0) {
    drivers.push(...customDrivers);
  }
}

function getDisk<U extends Driver>(diskName: string): U {
  const diskConfig = availableDisks.find((item) => item.name === diskName);

  if (!diskConfig) {
    throw new Error(`Given disk is not defined: ${diskName}`);
  }

  const driver: Class<Driver> =
    typeof diskConfig.driver !== 'string'
      ? diskConfig.driver
      : drivers.find((item) => item && item['driverName'] === diskConfig.driver);

  if (!driver) {
    // Throw error missing built-in driver package.
    if ((<any>Object).values(DriverName).includes(diskConfig.driver)) {
      throw new Error(
        `Please install \`@file-storage/${diskConfig.driver}\` for ${diskConfig.driver} driver`,
      );
    }
    const name = typeof diskConfig.driver !== 'string' ? diskConfig.driver.name : diskConfig.driver;
    throw new Error(`Driver '${name}' is not declared.`);
  }

  return new driver(diskConfig) as U;
}

class StorageClass {
  /**
   * Get default disk instance.
   */
  private defaultDisk: Driver;

  /**
   * All plugin instances.
   */
  private pluginInstances: Plugin[];

  private uniqueFileName = false;

  constructor(config = true) {
    if (config) {
      this.config();
    }
  }

  get name() {
    return this.defaultDisk.name;
  }

  /**
   * Config for storage methods supported in the application.
   */
  config<U extends DiskConfig>(options: StorageConfiguration<U> = {}) {
    const { diskConfigs = [], customDrivers = [], uniqueFileName = false } = options;
    let { defaultDiskName } = options;

    handleDiskConfigs(diskConfigs);
    addCustomDriver(customDrivers);

    if (!defaultDiskName) {
      if (availableDisks.length > 1) {
        throw new Error('Please specify a default disk name.');
      }
      defaultDiskName = availableDisks[0].name;
    }

    this.uniqueFileName = uniqueFileName;
    this.defaultDisk = getDisk(defaultDiskName);

    this.pluginInstances = plugins.map((pluginClass) => {
      const plugin = new pluginClass();
      plugin.init(this.defaultDisk);
      return plugin;
    });
  }

  /**
   * Get disk instance by diskName.
   *
   * @param diskName Disk name.
   * @param asStorage Return a storage instance.
   */
  disk<U extends Driver>(diskName?: string): U;
  disk(diskName: string, asStorage: true): StorageClass;

  disk(diskName?: string, asStorage = false) {
    if (!diskName) {
      return this.defaultDisk;
    }

    if (asStorage) {
      const storage = new StorageClass(false);
      storage.config({
        diskConfigs: availableDisks,
        defaultDiskName: diskName,
      });
      return storage;
    }

    return getDisk(diskName);
  }

  url(path: string) {
    return this.defaultDisk.url(path);
  }

  exists(path: string) {
    return this.defaultDisk.exists(path);
  }

  size(path: string): Promise<number> {
    return this.defaultDisk.size(path);
  }

  lastModified(path: string): Promise<number> {
    return this.defaultDisk.lastModified(path);
  }

  async put(data: Stream | Buffer, path: string): Promise<PutResult> {
    let result: PutResult = {
      success: true,
      message: 'Uploading success',
      name: getFileName(path),
      path,
    };

    if (this.uniqueFileName) {
      const parsedPath = parse(path);
      parsedPath.base = uuidv4() + parsedPath.ext;
      result.path = format(parsedPath);
    }

    const putData = await this.defaultDisk.put(data, result.path);

    result = Object.assign({}, result, putData);

    for (const plugin of this.pluginInstances) {
      if (plugin.afterPutKey && plugin.afterPut) {
        const afterPutData = await plugin.afterPut(result.path);
        result[plugin.afterPutKey] = afterPutData;
      }
    }

    return result;
  }

  get(path: string): Stream | Promise<Stream> {
    return this.defaultDisk.get(path);
  }

  delete(path: string): Promise<any> {
    return this.defaultDisk.delete(path);
  }

  copy(path: string, newPath: string): Promise<void> {
    return this.defaultDisk.copy(path, newPath);
  }

  move(path: string, newPath: string) {
    return this.defaultDisk.move(path, newPath);
  }

  makeDir(dir: string): Promise<string> {
    return this.defaultDisk.makeDir(dir);
  }

  removeDir(dir: string): Promise<string> {
    return this.defaultDisk.removeDir(dir);
  }

  uploadImageFromExternalUri(
    uri: string,
    path: string,
    ignoreHeaderContentType = false,
  ): Promise<any> {
    return this.defaultDisk.uploadImageFromExternalUri(uri, path, ignoreHeaderContentType);
  }

  imageStats(path: string, keepBuffer: true): Promise<ImageStats & { buffer: Buffer }>;
  imageStats(path: string, keepBuffer?: boolean): Promise<ImageStats>;

  imageStats(path: string, keepBuffer = false) {
    return this.defaultDisk.imageStats(path, keepBuffer);
  }
}

/**
 * `Storage` provides a filesystem abstraction, simple way to uses drivers for working with local filesystems, Amazon S3,...
 */
export const Storage = new StorageClass();
