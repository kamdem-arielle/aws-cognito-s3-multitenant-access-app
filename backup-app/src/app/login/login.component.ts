import { Component, inject } from '@angular/core';
import { ReactiveFormsModule,FormBuilder, Validators } from '@angular/forms';
import { CoreService } from '../services/core.service';

import { NgClass } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [NgClass,ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  // public username: string | null = null;
  public date: Date = new Date();
  public passwordInputTextHidden: boolean = true;
  public loading = false;
 

  private formBuilder = inject(FormBuilder);

  public loginForm =  this.formBuilder.group({
    username: [ "", Validators.required],
    password: [ "", Validators.required],
  });;

  constructor(private core: CoreService,private authService:AuthService) {}

  onSubmit() {
    this.loading = true;
    const values = this.loginForm.value;
    console.log('username and password')
    if (
      this.core.isEmptyOrNull(values.username) ||
      this.core.isEmptyOrNull(values.password)
    ) {
      console.log('username and password required')
      this.loading = false;
      return;
    }

    this.authService.authenticate(String(values.username), String(values.password))
      .then((credentials) => {
        console.log('Authentication successful', credentials);
        this.authService.listObjectsInPrefix(`${environment.s3BucketName}`).then((data) => { 
          console.log('S3 Data:', data);
          this.loading = false;
        }
        ).catch((error) => {
          console.error('Error listing S3 objects', error);
        })
        // this.loading = false;
      })
      .catch((error) => {
        console.error('Authentication failed', error);
        this.loading = false;
      }
      );
  }


  public togglePasswordVisibility(): void {
    this.passwordInputTextHidden = !this.passwordInputTextHidden;
  }


  changeLang(language: string) {

  }
}
