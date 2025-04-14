# AWS Setup Process for Cognito-Federated Access to S3

This document outlines the step-by-step AWS setup for enabling federated access to specific S3 bucket prefixes using Amazon Cognito User Pools, Identity Pools, and IAM roles with least privilege principles.

---

## 1. S3 Bucket and Prefixes

The first step was to create an **S3 bucket** to store backup files per client. Each client has a designated prefix (folder-like structure) inside the same bucket. For example:

- `clientA/`
- `clientB/`

These prefixes help isolate each client's data within the same bucket.

📸 **Screenshot: S3 Bucket Overview**  
![S3 Bucket](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/b0f27c47c7f9edb07c682f9d9de21eb906c6d7d2/images/image%20(1).png)

📸 **Screenshot: Prefixes for clientA and clientB**  
![S3 Prefixes](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/5bb21ba591534d24a9c6484dfcfa4503ee1d87a5/images/image%20(9).png)

---

## 2. IAM Policies for Least Privilege Access

Next, I created **IAM policies** for fine-grained, prefix-specific access to the S3 bucket. Each policy grants access **only** to the respective client’s prefix, following least privilege access control.

Below is an example of an IAM policy attached to a **Cognito IAM Role** for **Client A**. This policy ensures that:

- The client can **list objects** only within the `ClientA/` prefix.
- The client can **retrieve/download objects** under the `ClientA/` path only.
- The client **cannot view or access** data belonging to other clients.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VisualEditor0",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::backuptesbucket/ClientA/*"
    },
    {
      "Sid": "Statement1",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::backuptesbucket"
      ],
      "Condition": {
        "StringEquals": {
          "s3:prefix": "ClientA/"
        }
      }
    }
  ]
}

```
---

## 3. IAM Roles for Cognito Federated Access

To allow federated identities (from Cognito) to assume roles and access their respective S3 prefixes, I created **two IAM roles**, one for each client group.

At this stage, since I hadn’t created the Identity Pool yet (which requires roles to be pre-defined for group-based access), I temporarily used a **dummy Identity Pool ID** in the trust relationship when creating the IAM roles.

📸 **Screenshot: Role with Web Identity and Dummy Identity Pool ID**  
![IAM Role Web Identity](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/b0f27c47c7f9edb07c682f9d9de21eb906c6d7d2/images/image.png)

📸 **Screenshot: IAM Roles for clientA and clientB**
Each of this role have attached to them a policy like the one above to give access to data in a particular prefix
![IAM Roles](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/5bb21ba591534d24a9c6484dfcfa4503ee1d87a5/images/image%20(10).png)

---

## 4. Cognito User Pool and Groups

I then created an **Amazon Cognito User Pool**, followed by two user groups:

- `clientA`
- `clientB`

These groups align with the IAM roles created earlier.

---

## 5. Cognito Identity Pool and Role Mapping Rules

With the user pool and groups set up, I created an **Identity Pool**, configuring it to use **role mapping rules** based on group membership.

Each group was assigned a specific IAM role:

- Group `clientA` → IAM Role `clientA-role`
- Group `clientB` → IAM Role `clientB-role`

📸 **Screenshot: Identity Pool Trust Configuration (with Cognito User Pool as Identity Source)**  
![Identity Pool Trust](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/b0f27c47c7f9edb07c682f9d9de21eb906c6d7d2/images/image%20(4).png)

📸 **Screenshot: Role Mapping Rule Settings**  
![Role Mapping](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/b0f27c47c7f9edb07c682f9d9de21eb906c6d7d2/images/image%20(5).png)

---

## 6. Updating IAM Role Trust Policy with Final Identity Pool

After creating the Identity Pool, I updated the **trust relationship** of each IAM role to reference the **actual Identity Pool ID**, replacing the dummy one used during initial setup.

Below you will see  the trust policy attached to one of the role.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "cognito-identity.amazonaws.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "cognito-identity.amazonaws.com:aud": "us-east-1:1ded7e88-eefe-474e-a33e-ddfaf5345bbc"
                }
            }
        }
    ]
}
```
Make sure the cognito-identity.amazonaws.com:aud param corresponds to your identity pool id

📸 **Screenshot: Updated Trusted Entity with Final Identity Pool ID**  
![Update Trusted Entity](https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app/blob/b0f27c47c7f9edb07c682f9d9de21eb906c6d7d2/images/image%20(8).png)

---

## Points to Note

- ✅ **Block Public Access** to the S3 bucket to ensure that no objects are publicly accessible.
- 🌐 **Enable CORS Policy** on the bucket to allow cross-origin requests from your frontend application domain.
- 🔐 **Use Pre-Signed URLs** to securely provide temporary access to objects stored in the bucket.
- ⏳ **Set Expiry Time for Signed URLs** based on your access requirements.
- 📦 **Avoid Making the Entire Bucket Public**, even if the data seems non-sensitive.

---

## Sample CORS Configuration for S3 Bucket

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["https://yourdomain.com","localhost:4200"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

This concludes the AWS setup required for enabling fine-grained S3 access using Cognito-authenticated Angular web clients.Will add a small section which may be great to handle scaling

