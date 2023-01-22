import { AccessOptions, FTPContext } from 'basic-ftp';
import { DriverName } from '../enums/driver-name.enum.js';
import { DiskConfig } from './disk-config.interface.js';

export interface FtpDiskConfig extends DiskConfig {
  driver: DriverName.FTP;
  root?: string;
  accessOptions: AccessOptions;
  ftpContext?: Partial<FTPContext>;
}
