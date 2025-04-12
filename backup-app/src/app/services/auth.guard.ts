import { CanActivateFn, Router } from '@angular/router';
import { CoreService } from './core.service';
import { inject } from '@angular/core';

export const AuthGuard: CanActivateFn = (route, state) => {
  let core = inject(CoreService);
  let router = inject(Router);

  if (core.decryptFromLocalStorage("currentUser")) {
    // logged in so return true
    return true;
  }

  // not logged in so redirect to login page with the return url
  router.navigate(["login"]);
  return false;

};
