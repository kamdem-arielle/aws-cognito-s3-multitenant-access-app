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
import { HttpClient } from '@angular/common/http';

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

  constructor(private core:CoreService,private router:Router,private http: HttpClient) {}

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
  public async validateCredentials(): Promise<void> {
    if (!this.credentials || this.credentials.expired) {
      const idToken = this.core.decryptFromLocalStorage('idToken', false)

      if (!idToken) {
        console.error('No token found. Logging out...');
        this.logout();
        throw new Error('No token found.');
      }

      try {

        await this.configureAWSCredentials(idToken);
      } catch (err) {
        console.error('Failed to configure AWS credentials:', err);
        this.logout();
        throw err;
      }
    }
  }

  async getS3Prefixes(): Promise<string[]> {
    await this.validateCredentials();

    const bucket = this.core.clientBucket;
    const s3 = new AWS.S3();
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: bucket,
      Delimiter: '/'
    };

    try {
      const data = await s3.listObjectsV2(params).promise();


      const prefixes = (data.CommonPrefixes || []).map((prefix) => prefix.Prefix!.slice(0, -1));


      this.core.bucketMainPrefixes = prefixes;
      this.core.encryptToLocalStorage('bucketMainPrefixes', JSON.stringify(prefixes));
      return prefixes;
    } catch (err) {
      console.error('Error listing S3 prefixes:', err);
      throw err;
    }
  }


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

    downloadFile(fileUrl: string) {
    return new Promise<Blob>((resolve, reject) => {
      this.http.get(fileUrl, { responseType: 'blob' }).subscribe(
        (response) => {
          const blob = new Blob([response], { type: 'application/octet-stream' });
          resolve(blob)
        },
        (error) => {
          console.error('Error downloading file:', error);
          reject(error);
        }
      )
    })
  }

    print(printableArea: any, activeFileType: any, activeFileName: any, activeFileUrl: any) {
    if (['jpg', 'jpeg', 'png', 'gif'].includes(activeFileType)) {
      let timer = setTimeout(() => {
        const printContents = printableArea.nativeElement.innerHTML;
        const popupWin = window.open(
          "",
          "_blank",
          "width=1000,height=1000,location=no,left=200px"
        );
        if (popupWin) {
          popupWin.document.open();
          popupWin.document.write(
            '\
              <html> \
                  <head> \
                      <title></title> \
                      <link rel="stylesheet" type="text/css" href="../../assets/css/print.css" media="print" /> \
                  </head> \
                  <body> \
                      <div>'
          );
        } else {
          console.error("Failed to open popup window.");
          return;
        }
        popupWin.document.write(printContents);
        popupWin.document.write(
          "\
                    </div> \
                </body> \
            </html>"
        );
        popupWin.document.close();

        popupWin.addEventListener("load", () => {
          popupWin.focus();
          popupWin.print();
          popupWin.close();
        });
        clearTimeout(timer);
      }, 10);
    }
    else if (['mp4', 'webm', 'ogg', 'mov'].includes(activeFileType)) {
      // Open video info in a printable format
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
            <html>
              <head>
                <title>${activeFileName}</title>
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                  }
                  .video-info {
                    max-width: 600px;
                    margin: 0 auto;
                  }
                  h1 {
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 10px;
                  }
                </style>
              </head>
              <body>
                <div class="video-info">
                  <h1>Video: ${activeFileName}</h1>
                  <p><strong>File Type:</strong> ${activeFileType.toUpperCase()} video</p>
                  <p><strong>Location:</strong> <a href="${activeFileUrl}">${activeFileUrl}</a></p>
                  <p>Note: Video files cannot be directly printed. This information sheet is provided as an alternative.</p>
                </div>
                <script>
                  window.onload = function() {
                    setTimeout(() => {
                      window.print();
                      window.close();
                    }, 500);
                  };
                </script>
              </body>
            </html>
          `);
        printWindow.document.close();
      }
    }
    // For PDF and other files
    else {
      // Create a hidden iframe to load and print the file
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = activeFileUrl;

      iframe.onload = () => {
        try {
          iframe.contentWindow?.print();
        } catch (error) {
          // If direct print fails, open in new window
          window.open(activeFileUrl, '_blank')?.print();
        }

        // Remove the iframe after print dialog is shown
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };

      document.body.appendChild(iframe);
    }


  }

}

