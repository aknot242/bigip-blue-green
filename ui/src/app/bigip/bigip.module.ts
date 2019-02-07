import { NgModule, ModuleWithProviders } from '@angular/core';
import { BigIpService } from './services';

@NgModule()
export class BigIpModule {

  static forRoot(): ModuleWithProviders {
    return {
      ngModule: BigIpModule,
      providers: [
        BigIpService
      ]
    }
  }
}
