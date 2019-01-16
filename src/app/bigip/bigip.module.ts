import { NgModule, ModuleWithProviders } from '@angular/core';

import { BigIpService, BigIpConfigService } from './services';
import { BigIpConfig } from './models/bigip-config';

@NgModule()
export class BigIpModule {

  static forRoot(config: BigIpConfig): ModuleWithProviders {
    return {
      ngModule: BigIpModule,
      providers: [
        BigIpService,
        {
          provide: BigIpConfigService,
          useValue: config
        }
      ]
    }
  }
}