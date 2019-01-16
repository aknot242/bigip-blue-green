import { Component, ViewEncapsulation } from '@angular/core';
import { BigIpService } from './bigip/services/bigip.service';
import { forkJoin } from 'rxjs';
import { Distribution } from './bigip/models/distribution';
import { VirtualServerReference } from './bigip/models/virtual-server-reference';

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
  constructor(public bigIpService: BigIpService) { }

  title = 'bigip-blue-green';

  partitions = new Array<string>();
  partitionVirtualServers = new Array<VirtualServerReference>();
  partitionPools = new Array<string>();
  selectedVirtualServer: VirtualServerReference;
  bluePool = '';
  greenPool = '';
  currentTrafficDist = 55;
  newTrafficDist = 0;
  selectedPartition = '';

  ngOnInit() {
    this.newTrafficDist = this.currentTrafficDist;
    this.bigIpService.getAuthToken()
      .subscribe(() => this.bigIpService.getPartitions()
        .subscribe((partitions) => {
          this.partitions = partitions;
        }));
  }

  loadVirtualServersAndPools(partition: string) {
    let virtualServers$ = this.bigIpService.getVirtualServersByPartition(partition);
    let pools$ = this.bigIpService.getPoolsByPartition(partition);

    forkJoin([virtualServers$, pools$]).subscribe((results) => {
      this.partitionVirtualServers = results[0];
      this.partitionPools = results[1];
    });
  }

  onSet() {
    const dist: Distribution = { ratio: Number((100 - this.newTrafficDist) / 100), bluePool: this.bluePool, greenPool: this.greenPool };
    this.bigIpService.setDataGroup(this.selectedPartition, this.selectedVirtualServer, dist)
      .subscribe((status) => {
        console.log(status);
        // check if the irule is present, and plug it in!
        this.bigIpService.shimIRule(this.selectedVirtualServer)
          .subscribe((rules) => { console.log(rules); })
      });
  }

  unSet() {
    this.bigIpService.unShimIRuleAndDeleteDatagroup(this.selectedPartition, this.selectedVirtualServer)
      .subscribe((status) => {
        console.log(status);
      });
  }

  formatLabel(value: number | null) {
    return `${value}% | ${100 - value}%`;
  }
}
