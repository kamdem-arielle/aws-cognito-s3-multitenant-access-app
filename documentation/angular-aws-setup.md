# AWS Setup Process for Cognito-Federated Access to S3

This document outlines the step-by-step AWS setup for enabling federated access to specific S3 bucket prefixes using Amazon Cognito User Pools, Identity Pools, and IAM roles with least privilege principles.

---

## 1. S3 Bucket and Prefixes

The first step was to create an **S3 bucket** to store backup files per client. Each client has a designated prefix (folder-like structure) inside the same bucket. For example:

- `clientA/`
- `clientB/`

These prefixes help isolate each client's data within the same bucket.

📸 **Screenshot: S3 Bucket Overview**  
![S3 Bucket](./images/s3-bucket.png)

📸 **Screenshot: Prefixes for clientA and clientB**  
![S3 Prefixes](./images/s3-prefixes.png)

---

## 2. IAM Policies for Least Privilege Access

Next, I created **IAM policies** for fine-grained, prefix-specific access to the S3 bucket. Each policy grants access **only** to the respective client’s prefix, following least privilege access control.

---

## 3. IAM Roles for Cognito Federated Access

To allow federated identities (from Cognito) to assume roles and access their respective S3 prefixes, I created **two IAM roles**, one for each client group.

At this stage, since I hadn’t created the Identity Pool yet (which requires roles to be pre-defined for group-based access), I temporarily used a **dummy Identity Pool ID** in the trust relationship when creating the IAM roles.

📸 **Screenshot: Role with Web Identity and Dummy Identity Pool ID**  
![IAM Role Web Identity](./images/iam-role-web-identity.png)

📸 **Screenshot: IAM Roles for clientA and clientB**  
![IAM Roles](./images/iam-roles.png)

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
![Identity Pool Trust](./images/identity-pool-trust.png)

📸 **Screenshot: Role Mapping Rule Settings**  
![Role Mapping](./images/role-mapping-rules.png)

---

## 6. Updating IAM Role Trust Policy with Final Identity Pool

After creating the Identity Pool, I updated the **trust relationship** of each IAM role to reference the **actual Identity Pool ID**, replacing the dummy one used during initial setup.

📸 **Screenshot: Updated Trusted Entity with Final Identity Pool ID**  
![Update Trusted Entity](./images/updated-trusted-entity.png)

---

This concludes the AWS backend setup required for enabling fine-grained S3 access using Cognito-authenticated Angular web clients.

