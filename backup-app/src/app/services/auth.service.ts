import { Injectable } from '@angular/core';

import {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser,
  CognitoUserSession
} from 'amazon-cognito-identity-js';

import { environment } from '../../environments/environment';
import * as AWS from 'aws-sdk';
import { CoreService } from './core.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})

export class AuthService {
  private userPool = new CognitoUserPool({
    UserPoolId: environment.userPoolId,
    ClientId: environment.userPoolWebClientId
  });

  private clientPrefix = ''; // Prefix for S3 objects
  private credentials: AWS.CognitoIdentityCredentials | null = null;

  constructor(private core:CoreService,private router:Router) {}

  async authenticate(username: string, password: string): Promise<AWS.Credentials> {
    const userData = { Username: username, Pool: this.userPool };
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    const cognitoUser = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (result) => {
          const idToken = result.getIdToken().getJwtToken();
          localStorage.setItem('idToken', idToken);

          await this.configureAWSCredentials(idToken);

          await this.extractClientPrefixFromSession(cognitoUser);

          resolve(AWS.config.credentials as AWS.Credentials);
        },

        newPasswordRequired: (userAttributes, requiredAttributes) => {
          cognitoUser.completeNewPasswordChallenge(
            environment.challenge, // Replace with actual input
            {},
            {
              onSuccess: async (session) => {
                const idToken = session.getIdToken().getJwtToken();
                localStorage.setItem('idToken', idToken);

                await this.configureAWSCredentials(idToken);
                await this.extractClientPrefixFromSession(cognitoUser);

                resolve(AWS.config.credentials as AWS.Credentials);
              },
              onFailure: (err) => reject(err)
            }
          );
        },

        onFailure: (err) => {
          console.error('Authentication failed:', err);
          reject(err);
        }
      });
    });
  }

  private async extractClientPrefixFromSession(cognitoUser: CognitoUser): Promise<void> {
    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          console.error('Session retrieval error:', err);
          return reject(err);
        }

        const payload = session.getIdToken().decodePayload();
        const groups = payload['cognito:groups'];

        if (groups && groups.length > 0) {
          this.clientPrefix = `${groups[0]}/`;
          this.core.encryptToLocalStorage('clientPrefix', this.clientPrefix);
          // localStorage.setItem('clientPrefix', this.clientPrefix);
          console.log('Client prefix:', this.clientPrefix);
        } else {
          console.warn('User does not belong to any Cognito group');
        }

        resolve();
      });
    });
  }

  private async configureAWSCredentials(idToken: string): Promise<void> {
    AWS.config.region = environment.region;

    this.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: environment.identityPoolId,
      Logins: {
        [`cognito-idp.${environment.region}.amazonaws.com/${environment.userPoolId}`]: idToken,
      },
    });

    AWS.config.credentials = this.credentials;
    await this.credentials.getPromise();
  }

  async initSession(): Promise<boolean> {
    // const idToken = localStorage.getItem('idToken');

    const idToken = this.core.decryptFromLocalStorage('idToken', false);
    if (!idToken) return false;

    try {
      await this.configureAWSCredentials(idToken);
      return true;
    } catch (err) {
      console.error('Session expired or invalid token:', err);
      this.logout();
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem('idToken');
    localStorage.removeItem('clientPrefix');
    this.router.navigate(['/login']);
    AWS.config.credentials = null;
    this.credentials = null;
  }

  listObjectsInPrefix(bucket: string): Promise<AWS.S3.ObjectList> {
    this.clientPrefix = this.clientPrefix ?  this.clientPrefix : this.core.decryptFromLocalStorage('clientPrefix', false);
    console.log('Client prefix:', this.clientPrefix);
    const s3 = new AWS.S3();
    return new Promise((resolve, reject) => {
      s3.listObjectsV2({ Bucket: bucket, Prefix: this.clientPrefix }, (err, data) => {
        if (err) reject(err);
        else {
          const files = (data.Contents || [])
            .filter((obj:any) => obj.Size > 0) 
            .map(obj => ({
              key: obj.Key!,
              url: this.generateSignedUrl(bucket, obj.Key!),
              LastModified : obj.LastModified,
              Size: obj.Size ? obj.Size / 1024 : 0 // Size in KB

            }));
  
          resolve(files);
        }
      });
    });
  }


  // async listObjectsInPrefix(prefix: any): Promise<AWS.S3.ObjectList> {
  //   await this.validateCredentials();
  //   let bucket = this.core.clientBucket;
  //   const s3 = new AWS.S3();
  //   const data = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix }).promise();
  //   const files = (data.Contents || [])
  //     .filter((obj: any) => obj.Key != prefix)
  //     .map((obj: any) => {
  //       if (obj.Size > 0) {
  //         return {
  //           key: (obj.Key!).replace(prefix, ''),
  //           url: this.generateSignedUrl(bucket, obj.Key!),
  //           LastModified: obj.LastModified,
  //           Size: obj.Size ? obj.Size / 1024 : 0 ,
  //           type: 'file'
  //         };
  //       }else{
  //         return {
  //           key: ((obj.Key!).replace(prefix, '')).replace(/\/$/, ''),
  //           url: obj.Key,
  //           LastModified: obj.LastModified,
  //           Size: 0,
  //           type : 'folder'
  //         };
  //       }
    
  //     })
    

  //   return files;
  // }


  generateSignedUrl(bucket: string, key: string): string {
    const s3 = new AWS.S3();
    const params = {
      Bucket: bucket,
      Key: key,
      Expires: 86400 // Link is valid for 24 hours (60 * 60 * 24)
    };
  
    return s3.getSignedUrl('getObject', params);
  }

  async isUserAuthenticated(){
    const isLoggedIn = await this.initSession();
    if (isLoggedIn) {
      return true;
    } else {
      return false;
    }
  }

    // async listObjectsInBucket(): Promise<AWS.S3.ObjectList> {
  //   let bucket = this.core.clientBucket;
  //   let bucketObjects: any = [];
  //   const s3 = new AWS.S3();

  //   const data = await s3.listObjectsV2({ Bucket: bucket, Delimiter: '/' }).promise();
  //   console.log('S3 prefixes:', data.CommonPrefixes);

  //   const prefixes = data.CommonPrefixes || [];

  //   for (const prefix of prefixes) {
  //     const prefixData = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix.Prefix }).promise();
  //     const files = (prefixData.Contents || [])
  //       .filter((obj: any) => obj.Size > 0)
  //       .map(obj => ({
  //         key: obj.Key!,
  //         url: this.generateSignedUrl(bucket, obj.Key!),
  //         LastModified: obj.LastModified,
  //         Size: obj.Size ? obj.Size / 1024 : 0 // Size in KB
  //       }));

  //     console.log('Files:', files);

  //     const prefixObjects = { prefix: prefix.Prefix, files: files };
  //     console.log('Prefix objects:', prefixObjects);

  //     bucketObjects.push(prefixObjects);
  //   }

  //   return bucketObjects;
  // }

}

