import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';

@Injectable()
export class AuthService {
  public currentToken = '';

  constructor(private http: HttpClient) { }

  getAuthToken() {
    return this.currentToken;
  }

  authenticate(): Observable<string> {
    return this.http.post<string>('/mgmt/shared/authn/login', {
      "needsToken": true,
      "loginProviderName": "tmos"
    }).pipe(
      map(response => response['token']['token']),
      tap(token => {
        this.currentToken = token;
      }));
  }
}
