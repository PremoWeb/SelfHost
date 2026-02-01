---
title: Cloud Providers
description: Connect and manage your cloud infrastructure
---

# Cloud Providers

Cloud Providers are external services that SelfHost integrates with to automate server provisioning and management. By connecting a provider, you can spin up new VPS instances directly from the SelfHost dashboard.

## Supported Providers

SelfHost currently supports the following infrastructure providers:

- **DigitalOcean**: Full support for Droplets and SSH key management.
- **Vultr**: Support for high-performance compute instances.
- **Amazon Web Services (AWS)**: Support for EC2 instances across all regions.
- **Hetzner**: Economical cloud hosting with full automation.
- **Generic (BYO)**: Bring any server with an IP address and SSH access.

## Connecting a Provider

To connect a new cloud provider, follow these steps:

### 1. Generate an API Token
Visit your provider's dashboard and generate a new API token or Access Key with read/write permissions.

### 2. Add to SelfHost
Go to the **Cloud Providers** section in the main sidebar and click **Add Provider**. Select your provider type and paste the API token.

### 3. Verify Connection
SelfHost will attempt to verify the token by fetching your account balance or existing instances. Once verified, the provider will appear as "Active".

## Managing Resources

Once a provider is connected, you can:

- **List Instances**: View all servers currently running on that provider.
- **Import Servers**: Bring existing cloud servers into your SelfHost projects.
- **Provision New Servers**: Spin up fresh instances with the SelfHost Agent pre-installed.
- **Monitor Costs**: View estimated monthly spend for each provider.

> [!TIP]
> Use **Shared Variables** to securely store provider-specific environment variables if you are orchestrating deployments across multiple clouds.

## Advanced Configuration

### AWS Regions
When using AWS, you can filter which regions SelfHost should scan for instances to improve performance and keep your dashboard focused.

### DigitalOcean Tags
SelfHost can automatically tag Droplets it creates to help you organize resources within the DigitalOcean cloud panel.
