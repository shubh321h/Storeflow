# StoreFlow

**StoreFlow** is a mobile store-management application designed to help small retail and kirana businesses manage their daily operations from one place.

It is built with **Expo, React Native, TypeScript, and Supabase**, with a focus on simple workflows for products, inventory, billing, customers, suppliers, expenses, and business records.

> 🚧 StoreFlow is currently under active development.

---

## ✨ Features

### 🏪 Store Management

* Business profile and settings
* Business-specific data management
* Store information for invoices and records

### 📦 Product Management

* Add and manage products
* Product categories
* Selling and purchase prices
* Product search
* Barcode support
* Product metadata lookup
* Manual product entry

### 📷 Barcode Scanner

* Scan product barcodes using the device camera
* Search existing products
* Look up product information from external metadata sources
* Save products for future use

### 📊 Inventory

* Track product stock
* Stock adjustments
* Stock movements
* Inventory updates related to sales

### 🧾 Billing

* Create sales
* Add products to a bill
* Quantity management
* Automatic total calculation
* Invoice numbering
* PDF invoice generation
* Invoice sharing

### 👥 Customers

* Customer management
* Customer transaction records
* Customer balances
* Ledger support

### 🚚 Suppliers

* Supplier management
* Supplier transaction records
* Supplier balances
* Ledger support

### 💰 Expenses

* Record business expenses
* Track business transactions

### 📈 Reports

* Sales information
* Product information
* Business transaction summaries

### 🔐 Authentication & Security

* Supabase Authentication
* Email authentication
* Google authentication
* Secure user sessions
* Business-level data access controls
* Row Level Security (RLS)

---

## 🛠️ Technology

| Technology       | Purpose                      |
| ---------------- | ---------------------------- |
| Expo             | Mobile application framework |
| React Native     | Mobile UI                    |
| TypeScript       | Application development      |
| Supabase         | Backend and authentication   |
| PostgreSQL       | Database                     |
| React Navigation | Application navigation       |
| Expo Camera      | Barcode scanning             |
| Open Food Facts  | Product information          |

---

## 📱 Platform

StoreFlow is primarily designed for:

**Android**

The application is currently intended for testing and development while features continue to evolve.

---

## 🏗️ Project Structure

```text
Storeflow/
├── assets/
├── components/
├── context/
├── lib/
├── screens/
├── supabase/
├── tests/
├── .github/
├── App.tsx
├── app.json
├── package.json
└── README.md
```

---

## ⚙️ Development

### Requirements

* Node.js
* npm
* Git
* Expo development environment
* Supabase project

### Install

```bash
npm install
```

### Start Development

```bash
npm start
```

### Run TypeScript Checks

```bash
npm run typecheck
```

---


### Security

**Never commit private credentials or secrets to the repository.**

Do not publish:

* Service-role keys
* Database passwords
* OAuth client secrets
* Private API keys
* Access tokens

Use environment variables or your CI/CD secret manager for sensitive configuration.

---

## 🗄️ Database

StoreFlow uses **Supabase/PostgreSQL** for application data.

The database supports the application's major areas including:

* Businesses
* Products
* Inventory
* Sales
* Customers
* Suppliers
* Expenses
* Payments
* Ledgers

Database access is protected using appropriate authentication and authorization mechanisms.

---

## 🔄 Application Workflow

### Product

```text
Add Product
     ↓
Product Information
     ↓
Save Product
     ↓
Inventory
```

### Barcode

```text
Scan Barcode
     ↓
Find Product
     ↓
Product Information
     ↓
Add / Update Product
```

### Billing

```text
Select Products
     ↓
Create Bill
     ↓
Calculate Total
     ↓
Complete Sale
     ↓
Update Records
     ↓
Generate Invoice
```

---

## 🤖 Automated Builds

The project includes GitHub Actions configuration for automated Android builds.

```text
GitHub Repository
       ↓
GitHub Actions
       ↓
Android Build
       ↓
APK
```

Build configuration is located in:

```text
.github/workflows/
```

---

## 🚧 Project Status

StoreFlow is an **active development project**.

Features and implementation details may change as development continues.

The project is currently focused on improving:

* Billing
* Inventory
* Barcode workflows
* Authentication
* Reports
* PDF invoices
* Overall reliability
* Security

---

## 🐛 Reporting Bugs

If you find a bug, please open a GitHub issue with:

1. Description of the problem
2. Steps to reproduce it
3. Expected behavior
4. Actual behavior
5. Relevant error message
6. Device/platform information

### Please do not include

* Passwords
* API keys
* Access tokens
* Private customer information
* Private business information
* Database credentials

---

## 🤝 Contributing

Contributions and technical feedback are welcome.

Before submitting changes:

* Keep changes focused
* Avoid exposing secrets
* Follow the existing TypeScript/React Native structure
* Test affected functionality
* Include useful information in pull requests

---

## 📄 License

See the repository's `LICENSE` file for licensing information.

---

## 🔗 Project

**GitHub:**
https://github.com/shubh321h/Storeflow

---

## 🙏 Built With

StoreFlow is built using open-source technologies including:

* Expo
* React Native
* TypeScript
* Supabase
* PostgreSQL
* React Navigation
* Open Food Facts

---

**StoreFlow — Simple and modern management for small retail businesses.**
