import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ConfigData } from '../models/config-data';
import { Declaration } from '../models/declaration';

const BASE_URI = '/mgmt/shared/blue-green';

@Injectable()
export class BigIpService {

  constructor(private http: HttpClient) { }

  /** GET configuration information from the big-ip */
  getBigIpConfigData(): Observable<ConfigData[]> {
    return this.http.get<ConfigData[]>(`${BASE_URI}/bigip-config`);
  }

  declarationExists(declarationName: string): Observable<boolean> {
    return this.http.get<boolean>(`${BASE_URI}/config/${declarationName}`)
    .pipe(tap(response => response !== undefined)) ;
  }

  createBlueGreenDeclaration(declaration: Declaration): Observable<any> {
    return this.http.post(`${BASE_URI}/declare`, declaration);
  }

  deleteBlueGreenDeclaration(declarationName: string): Observable<any> {
    return this.http.delete(`${BASE_URI}/declare/${declarationName}`);
  }
}
