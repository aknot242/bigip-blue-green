import { ObjectReference } from './object-reference';
import { VirtualServerReference } from './virtual-server-reference';

export class ConfigData {
  virtualServers: VirtualServerReference[];
  pools: ObjectReference[];
}
