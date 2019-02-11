import { Directive, forwardRef, Input } from '@angular/core';
import {
  AsyncValidator,
  AbstractControl,
  NG_ASYNC_VALIDATORS,
  ValidationErrors
} from '@angular/forms';
import { catchError, map } from 'rxjs/operators';
import { Observable, throwError, of as observableOf } from 'rxjs';
import { BigIpService } from './bigip/services/bigip.service';

@Directive({
  selector: '[uniqueDeclarationName]',
  providers: [
    {
      provide: NG_ASYNC_VALIDATORS,
      useExisting: forwardRef(() => UniqueDeclarationNameValidator),
      multi: true
    }
  ]
})
export class UniqueDeclarationNameValidator implements AsyncValidator {
  @Input() uniqueDeclarationName: boolean;
  constructor(private bigIpService: BigIpService) { }

  validate(ctrl: AbstractControl): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> {
    if (!this.uniqueDeclarationName || ctrl.value === null || String(ctrl.value).trim() === '') { return observableOf(null) }
    return this.bigIpService.declarationExists(ctrl.value).pipe(
      map(exists => (exists ? { uniqueDeclarationName: true } : null)),
      catchError((error) => {
        if (error.status === 404) {
          // handle error
          return observableOf(null);
        }
        return throwError(error);
      })
    );
  }
}
