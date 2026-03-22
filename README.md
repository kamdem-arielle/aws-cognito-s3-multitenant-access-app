 # AWS Cognito S3 Multitenant Access App

This project demonstrates how to implement secure multi-tenant access to an Amazon S3 bucket using AWS Cognito, IAM Roles, and Prefix-based S3 access. Each tenant (Client A, Client B) has isolated access to their data based on their identity and group membership in Cognito.
The concept applied here will later on be used to build a multi-corporate file management app.

##  Live Demo
- The site hasn't yet been deployed.

---

##  Features
-  Cognito User Pool with groups (Client A and B).
-  Identity Pool with role-based access.
-  IAM policies restricting access to S3 prefixes
-  S3 bucket structured with prefixes for data isolation
-  Angular frontend with cognito integration.
-  Infrastructure as code using AWS CDK.

## Tech Stack
- **AWS S3** – Secure object storage.
- **AWS Cognito** – User authentication and identity federation
- **IAM** – Role-based access management
- **AWS CDK** – Infrastructure as code
- **Angular 19** – Frontend integration(A small file management app like google drive to view the backup files).
- **GitHub Actions / Bitbucket Pipelines** – Deployment automation.

---

##  Documentation
Detailed explanations and architecture available in the documentation folder.

---

## Setup Instructions

1. Clone this repo:

    ```bash
   git clone https://github.com/kamdem-arielle/aws-cognito-s3-multitenant-access-app.git
   cd aws-cognito-s3-multitenant-access-app
   
   ```

---
##  Next steps

For now i gave a basic setup of how to setup this app.Subsequently I might update the app and deploy it to aws S3 and a subdomain via route 53.Also I will setup a github action pipeline for automated deployments 

---

Don't forget to star ⭐️ the repository if you find this helpful.
Check my profile and contact me if you need help on this.
