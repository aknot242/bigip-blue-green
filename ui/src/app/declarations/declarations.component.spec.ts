import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { DeclarationsComponent } from './declarations.component';
import { MatButtonModule, MatDialogModule, MatTableModule } from '@angular/material';
import { RouterTestingModule } from '@angular/router/testing';
import { BigIpService, AuthService } from '../bigip/services';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AuthDialog } from '../dialogs/auth-dialog';
import { ConfirmDialog } from '../dialogs/confirm-dialog';
import { BrowserDynamicTestingModule } from '@angular/platform-browser-dynamic/testing';

describe('DeclarationsComponent', () => {
  let component: DeclarationsComponent;
  let fixture: ComponentFixture<DeclarationsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        DeclarationsComponent,
        AuthDialog,
        ConfirmDialog
      ],
      imports: [
        NoopAnimationsModule,
        RouterTestingModule,
        MatButtonModule,
        MatDialogModule,
        MatTableModule
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
    fixture = TestBed.createComponent(DeclarationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
