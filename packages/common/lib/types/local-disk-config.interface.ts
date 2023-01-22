import { DriverName } from '../enums/driver-name.enum.js';
import { DiskConfig } from './disk-config.interface.js';

export interface LocalDiskConfig extends DiskConfig {
  driver: DriverName.LOCAL;
  root?: string;
  publicUrl?: string;
}
