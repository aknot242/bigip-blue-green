import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DeclarationDetailComponent } from './declaration-detail.component';
import { UniqueDeclarationNameValidator } from '../unique-declaration-name.directive';
import { MatButtonModule, MatFormFieldModule, MatSliderModule, MatSelectModule, MatInputModule, MatDialogModule } from '@angular/material';
import { RouterTestingModule } from '@angular/router/testing';
import { BigIpService, AuthService } from '../bigip/services';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BrowserDynamicTestingModule } from '@angular/platform-browser-dynamic/testing';
import { AuthDialog } from '../dialogs/auth-dialog';
import { ConfirmDialog } from '../dialogs/confirm-dialog';

describe('DeclarationDetailComponent', () => {
  let component: DeclarationDetailComponent;
  let fixture: ComponentFixture<DeclarationDetailComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        DeclarationDetailComponent,
        UniqueDeclarationNameValidator,
        AuthDialog,
        ConfirmDialog
      ],
      imports: [
        FormsModule,
        NoopAnimationsModule,
        RouterTestingModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSliderModule,
        MatSelectModule,
        MatInputModule,
        MatDialogModule
      ],
      providers: [
        BigIpService,
        AuthService,
        HttpClient,
        HttpHandler
      ]
    })
    .overrideModule(BrowserDynamicTestingModule, {
      set: {
        entryComponents: [AuthDialog, ConfirmDialog],
      }
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeclarationDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
