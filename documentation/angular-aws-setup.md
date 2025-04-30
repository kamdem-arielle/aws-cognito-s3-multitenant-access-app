# Angular AWS S3 Role-Based Access Application

This project is built using Angular 18 and integrates with AWS services like Amazon Cognito and S3. It implements secure client-based access to S3 objects with role-based permissions. Below is the setup for the Angular project, the libraries used, and the configuration steps for AWS Cognito and S3.

## Project Setup


1. **Create Angular Project**
   
   - This project was generated using Angular 18.
   - Run the following command to create the project:
     
 ```bash
  ng new backup-app
 ```
   - You can find the Angular project inside the `backup-app` folder.

2. **Main libraries Used**
   - `crypto-js`: For data encryption and decryption in local storage.
   - `aws-sdk`: To interact with AWS services (Cognito, S3).
   - `amazon-cognito-identity-js`: To authenticate users via Cognito and manage AWS credentials.

Install the required libraries using the following commands:

```bash
npm install aws-sdk amazon-cognito-identity-js crypto-js
```

3. **Data encryption**

To enhance security, sensitive data is encrypted before storing it in localStorage and decrypted when retrieving. The crypto-js library is used to handle this encryption.

**Encrypt data in local storage**

```
encryptToLocalStorage(key: any, data: any) {
  localStorage.setItem(
    this.encryptData(key, this.encryptDecryptKeyPassword),
    this.encryptData(data, this.encryptDecryptValuePassword)
  );
}
 ```

**Decrypt data from local storage**

```
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

 ```


4. **Authentication with  aws cognito**

To authenticate users, the authenticate method uses AWS Cognito to verify user credentials and store the authentication token.Find below the code for the  **authenticate** method

```
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

```

5. **Common errors and fixes**

If you encounter a global error while running your Angular project, it might be due to certain dependencies like amazon-cognito-identity-js using Node globals. To resolve this, add the following line to your polyfills.ts file:
```
window.global = window;
```
Then, ensure that the polyfills.ts file is included in the scripts build section of your angular.json.

---


For additional details on the implementation and specific features, visit the app to see more about the app's design and functionality.



