import { Component, inject } from '@angular/core';
import { ReactiveFormsModule,FormBuilder, Validators } from '@angular/forms';
import { CoreService } from '../services/core.service';

import { NgClass } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [NgClass,ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  public username: string | null = null;
  public date: Date = new Date();
  public passwordInputTextHidden: boolean = true;
  public loading = false;
 

  private formBuilder = inject(FormBuilder);

  public loginForm =  this.formBuilder.group({
    username: ["", Validators.required],
    password: ["", Validators.required],
  });;

  constructor(private core: CoreService) {}

  onSubmit() {}


  togglePasswordVisibility(){}

  changeLang(language: string) {

  }
}
