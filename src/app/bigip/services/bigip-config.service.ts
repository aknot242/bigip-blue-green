import { InjectionToken } from '@angular/core';
import { BigIpConfig } from '../models/bigip-config';

/**
 * This is not a real service, but it looks like it from the outside.
 * It's just an InjectionToken used to import the config object, provided from the outside
 */
export const BigIpConfigService = new InjectionToken<BigIpConfig>("BigIpConfig");