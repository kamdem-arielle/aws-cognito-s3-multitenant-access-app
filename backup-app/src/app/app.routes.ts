import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [

    { path: "", component: LoginComponent },
    { path: "", component: DashboardComponent, canActivate: [AuthGuard] },

];
