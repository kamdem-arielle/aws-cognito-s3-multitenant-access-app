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

3. **Data Encryption with crypto-js**

Storing sensitive data such as authentication tokens and user identifiers in `localStorage` in plain text poses a security risk. To mitigate this, the application encrypts all data before writing it to `localStorage` and decrypts it upon retrieval. This is achieved using the `encryptData` and `decryptData` helper methods, which leverage the **crypto-js** library under the hood.

- **`encryptToLocalStorage`** — Encrypts both the key and the value before storing them in `localStorage`. This ensures that even the storage key itself is not human-readable, adding an extra layer of obfuscation.
- **`decryptFromLocalStorage`** — Retrieves an item from `localStorage`, decrypts the key to locate it, then decrypts the value. It supports returning the result as a parsed JSON object or as a raw string, depending on the `json` parameter.

**Encrypt data to localStorage**

```typescript
encryptToLocalStorage(key: any, data: any) {
  localStorage.setItem(
    this.encryptData(key, this.encryptDecryptKeyPassword),
    this.encryptData(data, this.encryptDecryptValuePassword)
  );
}
```

**Decrypt data from localStorage**

```typescript
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

> **Note:** Throughout the authentication flow described below, every call to `localStorage` uses these encrypted methods rather than the native `localStorage.setItem` / `getItem` APIs, ensuring tokens and prefixes are never stored in plain text.

---

4. **Configuring AWS Credentials — `configureAWSCredentials`**

Before diving into the authentication flow, it is important to understand the helper methods it relies on. The first is `configureAWSCredentials`, which is responsible for exchanging a Cognito ID token for temporary IAM credentials through a **Cognito Identity Pool** (Federated Identities). These temporary credentials allow the application to interact with AWS services like S3 on behalf of the authenticated user.

```typescript
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
```

**How it works:**

1. Sets the AWS SDK region from the environment configuration.
2. Creates a `CognitoIdentityCredentials` object, passing the Identity Pool ID and a `Logins` map that associates the Cognito User Pool provider with the user's ID token.
3. Assigns the credentials to the global `AWS.config.credentials` so all subsequent AWS SDK calls (e.g., S3 operations) automatically use them.
4. Calls `getPromise()` to asynchronously resolve the credentials — this triggers the behind-the-scenes STS `AssumeRoleWithWebIdentity` call that returns temporary `AccessKeyId`, `SecretAccessKey`, and `SessionToken` values.

The IAM role assumed through the Identity Pool defines exactly which AWS resources the user can access, enabling fine-grained, role-based permissions at the AWS level.

---

5. **Extracting the Client Prefix — `extractClientPrefixFromSession`**

This application follows a **multi-tenant architecture** where each tenant's (client's) data is stored under a dedicated prefix (folder) in a shared S3 bucket. To enforce data isolation, the application must determine which prefix belongs to the currently authenticated user.

In AWS Cognito, users are assigned to **User Pool Groups**, and each group corresponds to a specific tenant. The `extractClientPrefixFromSession` method retrieves the authenticated user's session, decodes the ID token payload, and reads the `cognito:groups` claim. The first group in the list is used as the S3 prefix, ensuring the user can only access objects that belong to their tenant.

```typescript
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
        console.log('Client prefix:', this.clientPrefix);
      } else {
        console.warn('User does not belong to any Cognito group');
      }

      resolve();
    });
  });
}
```

The extracted prefix is encrypted and persisted in `localStorage` so it remains available across page navigations without requiring another round-trip to Cognito.

---

6. **Authentication with AWS Cognito**

With the two helper methods above in mind — `configureAWSCredentials` for obtaining temporary AWS credentials and `extractClientPrefixFromSession` for determining the user's tenant prefix — we can now look at the `authenticate` method that ties everything together.

The `authenticate` method uses the `amazon-cognito-identity-js` library to verify user credentials against an AWS Cognito User Pool. On a successful sign-in, it encrypts and stores the ID token in `localStorage`, calls `configureAWSCredentials` to obtain temporary IAM credentials, and then calls `extractClientPrefixFromSession` to resolve the user's S3 prefix. It finally resolves with the configured credentials so the rest of the application can make authorized AWS SDK calls.

```typescript
async authenticate(username: string, password: string): Promise<AWS.Credentials> {
  this.userPool = new CognitoUserPool({
    UserPoolId: environment.userPoolId,
    ClientId: environment.userPoolWebClientId
  });

  const userData = { Username: username, Pool: this.userPool };
  const authDetails = new AuthenticationDetails({ Username: username, Password: password });
  const cognitoUser = new CognitoUser(userData);

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: async (result: CognitoUserSession) => {
        const idToken = result.getIdToken().getJwtToken();

        this.core.encryptToLocalStorage('idToken', idToken);

        await this.configureAWSCredentials(idToken);
        await this.extractClientPrefixFromSession(cognitoUser);

        resolve(AWS.config.credentials as AWS.Credentials);
      },

      newPasswordRequired: (userAttributes: Record<string, string>, requiredAttributes: string[]) => {
        cognitoUser.completeNewPasswordChallenge(
          environment.challenge,
          {
            onSuccess: async (session: CognitoUserSession) => {
              const idToken = session.getIdToken().getJwtToken();
              this.core.encryptToLocalStorage('idToken', idToken);

              await this.configureAWSCredentials(idToken);
              await this.extractClientPrefixFromSession(cognitoUser);

              resolve(AWS.config.credentials as AWS.Credentials);
            },
            onFailure: (err: Error) => reject(err)
          }
        );
      },

      onFailure: (err: Error) => {
        console.error('Authentication failed:', err);
        reject(err);
      }
    });
  });
}
```

### Understanding the `newPasswordRequired` Callback

When a user is created in the AWS Cognito Console (or via the Admin API) with a temporary password, Cognito marks the account status as **FORCE_CHANGE_PASSWORD**. The first time that user attempts to sign in, Cognito does not return a successful session. Instead, it triggers the `newPasswordRequired` callback, signalling that the user must set a new, permanent password before authentication can complete.

In this implementation, `completeNewPasswordChallenge` is called within the callback to programmatically fulfil that requirement. Once the password challenge is resolved, the flow mirrors the standard `onSuccess` path — the ID token is encrypted and stored, AWS credentials are configured, and the client prefix is extracted.

> **In a production environment**, you would typically redirect the user to a "Change Password" form and pass the user-supplied new password to `completeNewPasswordChallenge` rather than using a hard-coded value.

---

7. **Listing S3 Objects by Client Prefix — `listObjectsInPrefix`**

Once the user is authenticated and the client prefix has been resolved, the application can fetch the tenant's files from S3. The `listObjectsInPrefix` method uses the AWS S3 SDK to list all objects under the authenticated user's prefix in the specified bucket.

The method first ensures the client prefix is available — either from the in-memory value set during authentication, or by decrypting it from `localStorage` (useful after a page reload). It then calls `s3.listObjectsV2` with the bucket name and prefix to retrieve only the objects that belong to the current tenant.

Each returned S3 object is mapped into a structured result with its key, a pre-signed download URL, last modified date, size, and a `type` field. The `type` is determined by evaluating the object's `Size` property:

- **Files** (`Size > 0`): The client prefix is stripped from the key to produce a clean, relative path. The size is converted from bytes to megabytes, and a time-limited signed URL is generated for secure download.
- **Folders** (`Size === 0`): S3 represents folders as zero-byte objects with a trailing `/`. The key is cleaned by removing both the prefix and the trailing slash, and no download URL is needed.

```typescript
listObjectsInPrefix(bucket: string): Promise<AWS.S3.ObjectList> {
  this.clientPrefix = this.clientPrefix
    ? this.clientPrefix
    : this.core.decryptFromLocalStorage('clientPrefix', false);
  let clientPrefix = this.clientPrefix;
  const s3 = new AWS.S3();

  return new Promise((resolve, reject) => {
    s3.listObjectsV2(
      { Bucket: bucket, Prefix: this.clientPrefix },
      (err: AWS.AWSError, data: AWS.S3.ListObjectsV2Output) => {
        if (err) reject(err);
        else {
          const files = (data.Contents || [])
            .filter((obj: AWS.S3.Object) => obj.Size && obj.Size > 0)
            .map((obj: AWS.S3.Object) => {
              if (obj.Size > 0) {
                return {
                  key: obj.Key!.replace(clientPrefix, ''),
                  url: this.generateSignedUrl(bucket, obj.Key!),
                  LastModified: obj.LastModified,
                  Size: obj.Size ? obj.Size / (1024 * 1024) : 0,
                  type: 'file',
                  name: obj.Key!.replace(clientPrefix, '')
                };
              } else {
                return {
                  key: obj.Key!.replace(clientPrefix, '').replace(/\/$/, ''),
                  url: obj.Key,
                  LastModified: obj.LastModified,
                  Size: 0,
                  type: 'folder',
                  name: obj.Key!.replace(clientPrefix, '').replace(/\/$/, '')
                };
              }
            });

          resolve(files);
        }
      }
    );
  });
}
```

This method demonstrates the core benefit of the multi-tenant architecture: by scoping the S3 query to the user's prefix, each tenant only ever sees their own data, even though all tenants share the same bucket.

---

8. **Session Persistence — `initSession`**

When a user reloads the browser or navigates back to the application, the authentication state would normally be lost since Cognito sessions are held in memory. The `initSession` method restores the session by retrieving the encrypted ID token from `localStorage` and re-configuring AWS credentials.

```typescript
async initSession(): Promise<boolean> {
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
```

**Flow:**

1. Decrypts the stored ID token from `localStorage`. If no token is found, the user is not authenticated — the method returns `false`.
2. Attempts to configure AWS credentials using the recovered token by calling `configureAWSCredentials`.
3. If the token is still valid and credentials are successfully obtained, the method returns `true`, allowing the application to proceed normally.
4. If the token has expired or is invalid, the credential exchange will fail. In that case, the method calls `logout()` to clear all stored data and redirect the user to the login page, then returns `false`.

This method is typically invoked by a route guard on application startup, ensuring that protected routes are only accessible when the user holds a valid, non-expired session.

---

9. **Common Errors and Fixes**

If you encounter a global error while running your Angular project, it might be due to certain dependencies like amazon-cognito-identity-js using Node globals. To resolve this, add the following line to your polyfills.ts file:
```
window.global = window;
```
Then, ensure that the polyfills.ts file is included in the scripts build section of your angular.json.

---


For additional details on the implementation and specific features, visit the app to see more about the app's design and functionality.



