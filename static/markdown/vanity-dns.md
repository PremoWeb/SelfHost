---
title: Setting Up Vanity DNS with Vultr
description: Learn how to configure white-labeled nameservers (ns1.yourdomain.com) using Vultr DNS and popular registrars like Spaceship, Porkbun, and Epik.
---

# Setting Up Vanity DNS with Vultr

Vanity DNS (also known as branded DNS or white-label DNS) allows you to use your own domain name as the nameserver for your infrastructure. Instead of using default Vultr nameservers, you can use `ns1.example.com` and `ns2.example.com`.

This guide demonstrates how to set up vanity DNS using the Vultr DNS service and configure glue records at popular registrars.

## Prerequisites

Before you begin, ensure you have:
- Access to your domain registrar's control panel.
- Added your domain name to Vultr DNS.
- Identified the Vultr Anycast IP addresses for DNS:
  - **IPv4:** `173.199.96.96`, `173.199.96.97`
  - **IPv6:** `2001:19f0:ccc::1`, `2001:19f0:ccc::2`

---

## Step 1: Set Up Glue Records on Domain Registrar

Glue records (also called child nameservers or host records) tell the internet where to find your nameservers by associating their hostnames (e.g., `ns1.example.com`) with their IP addresses.

### Spaceship
1. Log in to your Spaceship account.
2. Go to **Domain List** and click on your domain.
3. In the sidebar, select **Advanced DNS**.
4. Scroll down to the **GLUE RECORDS** section.
5. Click **Add New Record**.
6. Enter `ns1` as the hostname and `173.199.96.96` as the IP address.
7. Repeat for `ns2` with `173.199.96.97`.

### Porkbun
1. Log in to Porkbun and go to the **Domain Management** page.
2. Click the **Details** button next to your domain.
3. Find the **Glue Records** section and click **Edit**.
4. Enter `ns1` in the Host field and `173.199.96.96` in the IP field.
5. Click **Add**.
6. Repeat for `ns2` with `173.199.96.97`.

### Epik
1. Log in to your Epik account.
2. Go to your domain's dashboard.
3. Look for **Child Name Servers** or **Host Records** in the menu.
4. Add a new record for `ns1` with `173.199.96.96`.
5. Add a second record for `ns2` with `173.199.96.97`.

---

## Step 2: Set Up DNS Records on Vultr

Once glue records are set, you must configure the actual DNS records within the Vultr Customer Portal.

1. Log in to the [Vultr Customer Portal](https://my.vultr.com/).
2. Navigate to **Network > DNS**.
3. Click on your domain name.

### Add Host Records
Add the following A and AAAA records to your zone so the nameservers themselves resolve:

| Type | Name | Data |
| :--- | :--- | :--- |
| A | ns1 | 173.199.96.96 |
| A | ns2 | 173.199.96.97 |
| AAAA | ns1 | 2001:19f0:ccc::1 |
| AAAA | ns2 | 2001:19f0:ccc::2 |

### Update NS Records
Change the default NS records in the Vultr panel to point to your new vanity nameservers:

1. Locate the existing `NS` records (e.g., `ns1.vultr.com`).
2. Edit them to point to `ns1.example.com` and `ns2.example.com` respectively.

---

## Step 3: Change Nameservers on Domain Registrar

The final step is to tell the world to use your vanity nameservers instead of the registrar's defaults or Vultr's defaults.

1. Return to your registrar (Spaceship, Porkbun, or Epik).
2. Locate the **Nameservers** setting for your domain.
3. Choose **Custom Nameservers**.
4. Enter your new nameservers:
   - `ns1.example.com`
   - `ns2.example.com`
5. Save changes.

---

## Verification

You can verify your setup using the `dig` command-line tool.

### Check Glue Records
Fetch the A records from the TLD nameservers directly:
```bash
dig @a.gtld-servers.net. example.com A
```
The output should include an `ADDITIONAL SECTION` with your `ns1` and `ns2` IP addresses.

### Check NS Records
Verify that your domain is reporting the correct nameservers:
```bash
dig +short example.com NS
```

> **Note:** DNS propagation can take up to 24-48 hours, though it usually happens much faster.
