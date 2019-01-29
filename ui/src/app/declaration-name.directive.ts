import { Directive, forwardRef, Injectable } from '@angular/core';
import {
  AsyncValidator,
  AbstractControl,
  NG_ASYNC_VALIDATORS,
  ValidationErrors
} from '@angular/forms';
import { catchError, map } from 'rxjs/operators';
import { Observable, throwError, of as observableOf } from 'rxjs';
import { BigIpService } from './bigip/services/bigip.service';

@Injectable({ providedIn: 'root' })
export class UniqueDeclarationNameValidator implements AsyncValidator {
  constructor(private bigIpService: BigIpService) {}

  validate(
    ctrl: AbstractControl
  ): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> {
    if (ctrl.value === null || String(ctrl.value).trim() === '') { return observableOf(null)}
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
export class UniqueDeclarationNameValidatorDirective {
  constructor(private validator: UniqueDeclarationNameValidator) {}

  validate(control: AbstractControl) {
    this.validator.validate(control);
  }
}
