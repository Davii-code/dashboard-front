import { Routes } from '@angular/router';
import {DashboardComponent} from './features/dashboard.component/dashboard.component';

export const routes: Routes = [
  {path: '', redirectTo: 'dash', pathMatch: 'full'},
  { path: 'dash', component: DashboardComponent },
];
