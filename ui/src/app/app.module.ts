import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule, MatFormFieldModule, MatSliderModule, MatSelectModule, MatInputModule, MatDialogModule, MatSnackBarModule, MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material';
import { BigIpService } from './bigip/services/bigip.service';
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { NgHttpLoaderModule } from 'ng-http-loader';
import { UniqueDeclarationNameValidatorDirective } from './declaration-name.directive';
import { AuthInterceptor } from './http-interceptors/auth-interceptor';
import { AuthService } from './bigip/services/auth.service';
import { AuthDialog } from './auth-dialog';

@NgModule({
  declarations: [
    AppComponent,
    UniqueDeclarationNameValidatorDirective,
    AuthDialog
  ],
  imports: [
    HttpClientModule,
    FormsModule,
    BrowserModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatButtonModule,
    MatSliderModule,
    MatSelectModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    NgHttpLoaderModule.forRoot()
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { duration: 2500 } },
    BigIpService,
    AuthService,
    HttpClient
  ],
  entryComponents: [AuthDialog],
  bootstrap: [AppComponent]
})
export class AppModule { }
