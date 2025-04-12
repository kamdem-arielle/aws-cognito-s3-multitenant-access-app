import { Injectable } from '@angular/core';

import {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser
} from 'amazon-cognito-identity-js';
import { environment } from '../../environments/environment';
import * as AWS from 'aws-sdk';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private userPool = new CognitoUserPool({
    UserPoolId: environment.userPoolId,
    ClientId: environment.userPoolWebClientId
  });
  

  private credentials: AWS.CognitoIdentityCredentials | null = null;

  constructor() { }

  authenticate(username: string , password: string): Promise<AWS.Credentials> {
    console.log('this.userPool',this.userPool)
    const userData = { Username: username, Pool: this.userPool };
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    console.log('authdetails',authDetails)
    const cognitoUser = new CognitoUser(userData);
    console.log('user',cognitoUser)
    console.log('user',cognitoUser.getSignInUserSession())
    console.log('user',cognitoUser)
    if (cognitoUser) {
      const session = cognitoUser.getSignInUserSession();
      if (session && session.getIdToken()) {
        console.log('user', session.getIdToken().payload["cognito:groups"]);
      }
    }
  
  
    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (result) => {
          console.log('success');
          const idToken = result.getIdToken().getJwtToken();
          localStorage.setItem('idToken', idToken);

          await this.configureAWSCredentials(idToken);

          resolve(AWS.config.credentials as AWS.Credentials);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Example: You can auto-set a new password or redirect to a "set new password" page
          console.log('New password is required for this user');
      
          cognitoUser.completeNewPasswordChallenge(
            environment.challenge, // ✅ Replace with real input
            {},
            {
              onSuccess: session => {
                // You can repeat your AWS credentials logic here
                const idToken = session.getIdToken().getJwtToken();
                localStorage.setItem('idToken', idToken);
                AWS.config.region = environment.region;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                  IdentityPoolId: environment.identityPoolId,
                  Logins: {
                    [`cognito-idp.${environment.region}.amazonaws.com/${environment.userPoolId}`]: idToken
                  }
                });
      
                (AWS.config.credentials as AWS.CognitoIdentityCredentials).getPromise().then(() => {
                  resolve(AWS.config.credentials as AWS.Credentials);
                });
              },
              onFailure: err => reject(err)
            }
          );
        },
        onFailure: (err) => {
          reject(err)
          console.log('failure');
        }
      
      });
    });
  }

  async configureAWSCredentials(idToken: string): Promise<void> {
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
    const idToken = localStorage.getItem('idToken');
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
    AWS.config.credentials = null;
    this.credentials = null;
  }

  listObjectsInPrefix(bucket: string): Promise<AWS.S3.ObjectList> {
    const s3 = new AWS.S3();
    return new Promise((resolve, reject) => {
      s3.listObjectsV2({ Bucket: bucket, Prefix:'ClientA/'}, (err, data) => {
        if (err) reject(err);
        else resolve(data.Contents || []);
      });
    });
  }

}
