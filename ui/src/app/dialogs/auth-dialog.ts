import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  selector: 'auth-dialog',
  templateUrl: 'auth-dialog.html',
})
export class AuthDialog {
  message: string;

  constructor(public dialogRef: MatDialogRef<AuthDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.message = data.message;
  }

  onOkClick(): void {
    this.dialogRef.close();
  }
}
