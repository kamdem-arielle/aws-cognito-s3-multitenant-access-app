import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CoreService {

    // For Encryption/Decryption
    public encryptDecryptValuePassword = "PetherSolutions.2020!";
    public encryptDecryptKeyPassword = "PetherSolutions.2021!";
    get salt() {
      return CryptoJS.enc.Hex.parse("4acfedc7dc72a9003a0dd721d7642bde");
    }
    get iv() {
      return CryptoJS.enc.Hex.parse("69135769514102d0eded589ff874cacd");
    }

    
  constructor(private auth:AuthService) { }

    // test if a string value is null, undefined or empty
    isEmptyOrNull(value: string | null | undefined) {
      if (
        value == "" ||
        value == null ||
        value == undefined ||
        value == "undefined"
      ) {
        return true;
      }
      return false;
    }
  

  encryptData(data: any, password: string) {
    let key128Bits100Iterations = CryptoJS.PBKDF2(password, this.salt, {
      keySize: 128 / 32,
      iterations: 100,
    });
    let encryptOutput = CryptoJS.AES.encrypt(data, key128Bits100Iterations, {
      iv: this.iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).toString();

    return encryptOutput;
  }

  decryptData(data: any, password: string) {
    let key128Bits100Iterations = CryptoJS.PBKDF2(password, this.salt, {
      keySize: 128 / 32,
      iterations: 100,
    });
    let decryptOutput = CryptoJS.AES.decrypt(data, key128Bits100Iterations, {
      iv: this.iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8);

    return decryptOutput;
  }

  encryptToLocalStorage(key: any, data: any) {
    localStorage.setItem(
      this.encryptData(key, this.encryptDecryptKeyPassword),
      this.encryptData(data, this.encryptDecryptValuePassword)
    );
  }

  decryptFromLocalStorage(key: any, json = true) {
    let encryptedKey = this.encryptData(key, this.encryptDecryptKeyPassword);
    if (!this.isEmptyOrNull(localStorage.getItem(encryptedKey))) {
      if (json == true)
        return JSON.parse(
          this.decryptData(
            localStorage.getItem(encryptedKey),
            this.encryptDecryptValuePassword
          )
        );
      else
        return this.decryptData(
          localStorage.getItem(encryptedKey),
          this.encryptDecryptValuePassword
        );
    } else {
      return "";
    }
  }


  removeFromLocalStorage(key: any) {
    let encryptedKey = this.encryptData(key, this.encryptDecryptKeyPassword);
    localStorage.removeItem(encryptedKey);
  }

  async isUserAuthenticated(){
    const isLoggedIn = await this.auth.initSession();
    if (isLoggedIn) {
      return true;
    } else {
      return false;
    }
  }
}
