import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DeclarationsComponent } from './declarations/declarations.component';
import { DeclarationDetailComponent } from './declaration-detail/declaration-detail.component';

const routes: Routes = [
  { path: '', redirectTo: '/declarations', pathMatch: 'full' },
  { path: 'detail', component: DeclarationDetailComponent },
  { path: 'detail/:name', component: DeclarationDetailComponent },
  { path: 'declarations', component: DeclarationsComponent }
];

@NgModule({
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}
