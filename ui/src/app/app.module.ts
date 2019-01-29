import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule, MatFormFieldModule, MatSliderModule, MatSelectModule, MatInputModule, MatSnackBarModule, MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material';
import { BigIpService } from './bigip/services/bigip.service';
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { BigIpConfig } from './bigip/models/bigip-config';
import { BigIpModule } from './bigip/bigip.module';
import { NgHttpLoaderModule } from 'ng-http-loader';
import { UniqueDeclarationNameValidatorDirective } from './declaration-name.directive';
import { AuthInterceptor } from './http-interceptors/auth-interceptor';
import { AuthService } from './bigip/services/auth.service';

/**
 * This is our configuration object!
 * REPLACE THE VALUES
 */
const bigIpConfig: BigIpConfig = {
  url: '',
  username: '',
  password: ''
}

@NgModule({
  declarations: [
    AppComponent,
    UniqueDeclarationNameValidatorDirective
  ],
  imports: [
    BigIpModule.forRoot(bigIpConfig),
    HttpClientModule,
    FormsModule,
    BrowserModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatButtonModule,
    MatSliderModule,
    MatSelectModule,
    MatInputModule,
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
  bootstrap: [AppComponent]
})
export class AppModule { }
