import { Component, ViewEncapsulation } from '@angular/core';
import { BigIpService } from './bigip/services/bigip.service';
import { ConfigData } from './bigip/models/config-data';
import { ObjectReference } from './bigip/models/object-reference';
import { Declaration } from './bigip/models/declaration';
import { MatSnackBar } from '@angular/material';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  /**
   *
   */
  constructor(public bigIpService: BigIpService, private snackBar: MatSnackBar) { }

  title = 'BIG-IP BlueGreen Deployment';
  declarationNameText = '';
  config = new Array<ConfigData>();
  partitions = new Array<string>();
  partitionVirtualServers = new Array<ObjectReference>();
  partitionPools = new Array<ObjectReference>();
  selectedVirtualServer: ObjectReference;
  bluePool: ObjectReference;
  greenPool: ObjectReference;
  currentTrafficDist = 55;
  newTrafficDist = 0;
  selectedPartition = '';

  ngOnInit() {
    this.newTrafficDist = this.currentTrafficDist;
    this.bigIpService.getBigIpConfigData()
      .subscribe((config) => {
        this.config = config;
        this.partitions = config.map(c => c.name);
      });
  }

  loadVirtualServersAndPools(partition: string) {
    const partitionObject = this.config.filter(p => p.name === partition)[0];
    this.partitionVirtualServers = partitionObject.virtualServers || [];
    this.partitionPools = partitionObject.pools || [];
  }

  onCreate() {
    const declaration: Declaration = {
      name: this.declarationNameText,
      partition: this.selectedPartition,
      virtualServerFullPath: this.selectedVirtualServer.fullPath,
      distribution: {
        ratio: Number((100 - this.newTrafficDist) / 100),
        bluePool: this.bluePool.name,
        greenPool: this.greenPool.name
      }
    }
    this.bigIpService.createBlueGreenDeclaration(declaration)
      .subscribe((status) => {
        console.log(status);
        this.snackBar.open(`declaration ${status.name} successfully created`);
      });
  }

  onDelete() {
    this.bigIpService.deleteBlueGreenDeclaration(this.declarationNameText)
      .subscribe((status) => {
        console.log(status);
        this.snackBar.open(`${status.message}`);
      });
  }

  formatLabel(value: number | null) {
    return `${value}% | ${100 - value}%`;
  }
}
