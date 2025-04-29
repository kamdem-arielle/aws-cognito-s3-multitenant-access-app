import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const AuthGuard: CanActivateFn = async (route, state) => {
  let auth = inject(AuthService);
  let router = inject(Router);
  const isAuthenticated = await auth.isUserAuthenticated();
 
  if (isAuthenticated) {
    // logged in so return true
    return true;
  }

  // not logged in so redirect to login page with the return url
  router.navigate(["login"]);
  return false;

};
