import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTableModule } from '@angular/material/table';
import { BigIpService, AuthService } from './bigip/services';
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { NgHttpLoaderModule } from 'ng-http-loader';
import { UniqueDeclarationNameValidator } from './unique-declaration-name.directive';
import { AuthInterceptor } from './http-interceptors/auth-interceptor';
import { AuthDialog } from './dialogs/auth-dialog';
import { DeclarationDetailComponent } from './declaration-detail/declaration-detail.component';
import { DeclarationsComponent } from './declarations/declarations.component';
import { AppRoutingModule } from './app-routing.module';
import { MessagesComponent } from './messages/messages.component';
import { ConfirmDialog } from './dialogs/confirm-dialog';

@NgModule({
  declarations: [
    AppComponent,
    UniqueDeclarationNameValidator,
    AuthDialog,
    ConfirmDialog,
    DeclarationDetailComponent,
    DeclarationsComponent,
    MessagesComponent
  ],
  imports: [
    AppRoutingModule,
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
    MatTableModule,
    NgHttpLoaderModule.forRoot()
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    BigIpService,
    AuthService,
    HttpClient
  ],
  entryComponents: [AuthDialog, ConfirmDialog],
  bootstrap: [AppComponent]
})
export class AppModule { }
