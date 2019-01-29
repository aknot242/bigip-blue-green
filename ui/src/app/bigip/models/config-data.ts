import { ObjectReference } from './object-reference';

export interface ConfigData {
  name: string,
  virtualServers: ObjectReference[];
  pools: ObjectReference[];
}
