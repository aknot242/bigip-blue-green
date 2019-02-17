import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ConfigData } from '../models/config-data';
import { Declaration } from '../models/declaration';
import { MessageService } from 'src/app/message.service';

const BASE_URI = '/mgmt/shared/blue-green';

@Injectable()
export class BigIpService {

  constructor(private http: HttpClient, private messageService: MessageService) { }

  /** GET configuration information from the big-ip */
  getBigIpConfigData(): Observable<ConfigData> {
    return this.http.get<ConfigData>(`${BASE_URI}/bigip-config`);
  }

  declarationExists(declarationName: string): Observable<boolean> {
    return this.http.get<boolean>(`${BASE_URI}/config/${declarationName}`)
      .pipe(tap(response => response !== undefined));
  }

  saveDeclaration(declaration: Declaration): Observable<any> {
    return this.http.post(`${BASE_URI}/declare`, declaration)
      .pipe(
        tap((status: any) => this.log(`declaration '${status.name}' successfully saved`)),
        catchError(this.handleError<any>('saveDeclaration'))
      );
  }

  deleteDeclaration(declarationName: string): Observable<any> {
    return this.http.delete(`${BASE_URI}/declare/${declarationName}`)
      .pipe(
        tap((status: any) => this.log(status.message)),
        catchError(this.handleError<any>('deleteDeclaration'))
      );
  }

  getAllDeclarations(): Observable<Declaration[]> {
    return this.http.get<Declaration[]>(`${BASE_URI}/config`)
      .pipe(
        catchError(this.handleError<any>('getAllDeclarations'))
      );
  }

  getDeclaration(declarationName: string): Observable<Declaration> {
    return this.http.get<Declaration>(`${BASE_URI}/config/${declarationName}`)
      .pipe(
        catchError(this.handleError<any>('getDeclaration'))
      );
  }

  /**
 * Handle Http operation that failed.
 * Let the app continue.
 * @param operation - name of the operation that failed
 * @param result - optional value to return as the observable result
 */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      console.error(error);

      // TODO: Super hacky. This is due to iControlLX errors coming back in a string. Need to clean this up once errors are being emitted in a structured way.
      const innerMessage = error.error.message;
      const keyWord = 'body:';
      const parsedError = innerMessage.substring(innerMessage.search(keyWord) + keyWord.length);
      this.log(parsedError);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  /** Log a BigIpService message with the MessageService */
  private log(message: string) {
    this.messageService.add(`BigIpService: ${message}`);
  }
}
