import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Injectable, Inject } from '@angular/core';
import { BigIpConfigService } from './bigip-config.service';

@Injectable()
export class AuthService {

  public currentToken = '';

  constructor(private http: HttpClient, @Inject(BigIpConfigService) private bigIp) {
  }

  getAuthToken() {
    return this.currentToken;
  }

  refreshToken(): Observable<string> {

    return this.http.post<string>(`${this.bigIp.url}/mgmt/shared/authn/login`, {
      "username": `${this.bigIp.username}`,
      "password": `${this.bigIp.password}`,
      "loginProviderName": "tmos"
    }).pipe(
      map(response => response['token']['token']),
      tap(token => this.currentToken = token));
  }
}
