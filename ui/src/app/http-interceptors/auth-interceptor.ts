import { throwError as observableThrowError, Observable, BehaviorSubject } from 'rxjs';
import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpSentEvent, HttpHeaderResponse, HttpProgressEvent, HttpResponse, HttpUserEvent } from '@angular/common/http';
import { AuthService } from '../bigip/services/auth.service';

// Inspired by: https://github.com/IntertechInc/http-interceptor-refresh-token

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  isRefreshingToken = false;
  tokenSubject = new BehaviorSubject<string>(null);

  constructor(private injector: Injector) { }

  addToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({ setHeaders: { 'X-F5-Auth-Token': token } })
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpSentEvent | HttpHeaderResponse | HttpProgressEvent | HttpResponse<any> | HttpUserEvent<any>> {
    const authService = this.injector.get(AuthService);

    if (req.url.toLowerCase() === '/mgmt/shared/authn/login' && req.method === 'POST' ) {
      return next.handle(req);
    }
    return next.handle(this.addToken(req, authService.getAuthToken()));
  }

  logoutUser() {
    // Route to the login page (implementation up to you)

    return observableThrowError('');
  }
}
