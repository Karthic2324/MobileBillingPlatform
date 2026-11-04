# Multi Vendor Billing (Invoxa)

A mobile billing and invoice app for Android, built with **React Native (Expo)** and **Supabase**. One **Controller** (admin) account manages many **Vendor** accounts. Each vendor creates GST invoices, keeps a product catalog, and sees their own sales reports, all from a phone.

## Features

**Vendor**
- Log in with **mobile number + password** (or email + password)
- **Invoice Builder:** customer details, item rows, per-item GST %, automatic CGST/SGST split, PDF export and sharing
- **Inventory:** product catalog with HSN code, price and a separate **GST %** for each product
- **Ledger:** search past invoices, **edit** an invoice after saving it, download the PDF again, delete
- **Reports:** total revenue for **today, this week, this month and this year**, with GST collected, amount received and pending balance
- **Account:** change password

**Controller (admin)**
- Create vendor accounts (mobile number + password)
- Edit each vendor's invoice details: company name, address, mobile number, GSTIN, invoice prefix and starting number, bank details
- View every vendor's invoices in one place

## Tech stack

| Layer | Technology |
|---|---|
| App | React Native with Expo |
| Navigation | React Navigation (bottom tabs) |
| Database and login | Supabase (PostgreSQL, Auth, Row Level Security) |
| PDF | `expo-print` and `expo-sharing` |
| Builds | EAS Build (Expo Application Services) |

## Project structure

```
MultiVendorBilling/
├── App.js                         # Login check, role-based tabs
├── app.json                       # Expo config (name, icon, package)
├── eas.json                       # Build profiles (preview = APK)
├── supabase_changes.sql           # Database changes (run once in Supabase)
├── assets/                        # App icon, adaptive icon layers, splash
└── src/
    ├── components/
    │   ├── AuthScreen.jsx         # Login / register (mobile or email)
    │   ├── InvoiceWorkstation.jsx # Invoice Builder
    │   ├── InvoiceEditModal.jsx   # Edit a saved invoice
    │   ├── VendorManagementModal.jsx  # Controller edits a vendor
    │   └── VendorInvoicesModal.jsx
    ├── screens/
    │   ├── AdminDashboardScreen.jsx   # Controller panel
    │   ├── ProductCatalogScreen.jsx   # Inventory
    │   ├── InvoiceHistoryScreen.jsx   # Ledger
    │   ├── ReportsScreen.jsx          # Day / week / month / year revenue
    │   └── AccountScreen.jsx          # Change password
    ├── utils/
    │   ├── generateInvoiceHTML.js # PDF layout
    │   ├── tax.js                 # GST calculation
    │   └── phone.js               # Mobile number helpers
    └── config/
        ├── supabase.js            # Supabase URL and public (anon) key
        └── supabaseAdminSignup.js # Lets the Controller create vendors without being logged out
```

## Getting started

### 1. Requirements
- Node.js 18 or newer
- A free [Supabase](https://supabase.com) project
- An [Expo](https://expo.dev) account (only for building the APK)
- The **Expo Go** app on your phone (for quick testing)

### 2. Install

```bash
git clone <your-repository-url>
cd MultiVendorBilling
npm install
```

### 3. Set up Supabase
1. Open `src/config/supabase.js` and enter your project's **URL** and **anon key** (Supabase → Project Settings → API).
2. In Supabase → **SQL Editor**, paste and run the whole of `supabase_changes.sql`. It adds the new columns and the security rules.
3. In Supabase → **Authentication → Sign In / Providers → Email**, turn **off** "Confirm email". Mobile number login works by turning the number into an internal address (`9876543210@multivendor.local`), so confirmation emails can't be delivered.
4. Create your Controller account, then set its `role` to `ADMIN` in the `profiles` table.

### 4. Run on your phone

```bash
npx expo start -c
```

Scan the QR code with Expo Go.

## Database overview

| Table | Purpose |
|---|---|
| `profiles` | One row per user: role (`ADMIN` or `VENDOR`), business name, address, phone, GSTIN, invoice prefix, bank details |
| `products` | A vendor's catalog (name, HSN, price, `gst_percent`) |
| `invoices` | Invoice header: number, customer, totals, received amount |
| `invoice_items` | Line items: description, HSN, GST %, quantity, rate, `line_no` |

Row Level Security keeps each vendor limited to their own rows, and the Controller can see and edit all of them.

## Build the Android app (APK)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

When the build finishes, EAS prints a download link for the APK. Open it on your phone to install.

For a Play Store build (AAB):

```bash
eas build -p android --profile production
```

> The `slug` in `app.json` must stay the same as the one the Expo project was created with, or EAS will refuse to build. Don't change the Android package name after you release the app.

## Security notes
- The Supabase **anon key** is meant to be public, and your data is protected by Row Level Security. Never put the Supabase **service_role** key in this app or in Git.
- Keep Row Level Security **enabled** on every table.

## Roadmap ideas
- Invoice numbering per financial year (April to March)
- Customer list and outstanding payments
- Export reports to Excel
- Play Store release

## License
Private project. All rights reserved. Add a license here if you decide to share it.
