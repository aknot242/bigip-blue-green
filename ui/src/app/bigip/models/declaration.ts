import { Distribution } from './distribution';
export interface Declaration {
  name: string;
  partition: string;
  virtualServerFullPath: string;
  distribution: Distribution;
}
