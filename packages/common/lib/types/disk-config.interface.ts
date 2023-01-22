import { Driver } from '../driver.class.js';
import { Class } from './class.type.js';

export interface DiskConfig {
  driver: string | Class<Driver>;
  name: string;
}
