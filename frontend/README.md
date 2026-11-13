# StockWise Inventory Frontend

A responsive React + Vite inventory management frontend designed for general stock control with optional automotive spare-parts capabilities.

## Features
- Dashboard with stock value, units on hand, low-stock and out-of-stock indicators.
- Product catalogue with search, category and stock filters, CRUD, SKU/barcode, supplier, manufacturer, pricing, locations and reorder levels.
- Optional automotive fitment fields: OEM/OE number, make, model, year range and cooling type.
- Stock receiving, issuing and quantity adjustment with transaction history and insufficient-stock validation.
- Categories, suppliers, manufacturers and vehicle reference lists.
- Inventory valuation, stock-health and movement reports with CSV exports.
- Settings and browser-local demo persistence.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The demo login accepts any non-empty email and password. Data is stored in the current browser's local storage.

## Supabase integration

This delivery runs independently in local demo mode. The original Supabase client and service files are retained for integration work, but the new UI uses the local demo store so all workflows can be tested without a database. Before production, connect the store actions to Supabase tables/RPCs and implement authentication, user roles, tenant/business scoping, audit history and row-level security. Do not treat browser local storage as secure or shared production storage.
