import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BigIpConfigService } from '../services/bigip-config.service'
import { tap } from 'rxjs/operators';
import { ConfigData } from '../models/config-data';
import { Declaration } from '../models/declaration';

@Injectable()
export class BigIpService {

  constructor(private http: HttpClient,
    @Inject(BigIpConfigService) private bigIp) { }

  /** GET configuration information from the big-ip */
  getBigIpConfigData(): Observable<ConfigData[]> {
    return this.http.get<ConfigData[]>(`${this.bigIp.url}/mgmt/shared/blue-green/bigip-config`);
  }

  declarationExists(declarationName: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.bigIp.url}/mgmt/shared/blue-green/config/${declarationName}`)
    .pipe(tap(response => response !== undefined)) ;
  }

  createBlueGreenDeclaration(declaration: Declaration): Observable<any> {
    return this.http.post(`${this.bigIp.url}/mgmt/shared/blue-green/declare`, declaration);
  }

  deleteBlueGreenDeclaration(declarationName: string): Observable<any> {
    return this.http.delete(`${this.bigIp.url}/mgmt/shared/blue-green/declare/${declarationName}`);
  }
}
