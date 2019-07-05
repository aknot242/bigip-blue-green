import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { switchMap, catchError } from 'rxjs/operators';
import { BigIpService, AuthService } from '../bigip/services';
import { Declaration } from '../bigip/models/declaration';
import { Observable, of } from 'rxjs';
import { AuthDialog } from '../dialogs/auth-dialog';
import { ConfirmDialog } from '../dialogs/confirm-dialog';

@Component({
  selector: 'app-declarations',
  templateUrl: './declarations.component.html',
  styleUrls: ['./declarations.component.css']
})
export class DeclarationsComponent implements OnInit {
  displayedColumns: string[] = ['name', 'virtualServer', 'action'];
  declarations: Observable<Declaration[]>;

  constructor(private bigIpService: BigIpService,
    private authService: AuthService,
    private dialog: MatDialog) { }

  ngOnInit() {
    this.declarations = this.getDeclarations();
  }

  getDeclarations(): Observable<Declaration[]> {
    // TODO: Move authentication somewhere central to all modules. HttpInterceptor maybe?
    return this.authService.authenticate()
      .pipe(
        switchMap(() => this.bigIpService.getAllDeclarations()),
        catchError((err) => {
          this.openAuthDialog(err.statusText);
          return of([]);
        })
      );
  }

  openAuthDialog(message: string): void {
    // Wrapping in a promise to work around issue: https://github.com/angular/material2/issues/5268
    Promise.resolve().then(() => {
      const dialogRef = this.dialog.open(AuthDialog, {
        data: { message: message },
      });
      dialogRef.afterClosed().subscribe(() => {
        window.location.href = '/xui/';
      });
    });
  }

  openConfirmDeleteDialog(objectName: string): void {
    const deleteDialogRef = this.dialog.open(ConfirmDialog, {
      width: '300px',
      data: { title: 'Confirm Delete', message: `Are you sure you want to delete '${objectName}'?` }
    });

    deleteDialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.bigIpService.deleteDeclaration(objectName).subscribe(() => {
          // TODO: Seems like a hacky way to trigger a table refresh
          this.declarations = this.getDeclarations();
        });
      }
    });
  }
}
