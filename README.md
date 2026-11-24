# ShusthoBazaar

A React/Vite medicine marketplace with a TypeScript NestJS API and SQLite persistence. The current payment option is a **local mock only**: it records a chosen success or failure in SQLite and does not contact a payment gateway or move real money.

## Setup and run

Requires Node.js 20.19+ (or 22.12+) and npm.

```sh
npm install
npm --prefix server install
cp .env.example .env
```

Set `JWT_SECRET` in `.env` to a random secret of at least 32 characters. Then initialize the database and start both apps:

```sh
npm run db:reset
npm run dev:full
```

The Vite frontend runs at `http://localhost:5173` and proxies `/api` requests to NestJS at `http://localhost:3001`. Other useful commands:

| Command | Purpose |
|---|---|
| `npm run dev` | Frontend only |
| `npm run server:dev` | NestJS API in TypeScript watch mode |
| `npm --prefix server run build` | Compile the API to `server/dist` |
| `npm run db:reset` | Delete the configured local database, migrate, and reseed |
| `npm --prefix server test` | Run API/database integration tests |
| `npm run lint` | Lint frontend and server |
| `npm run build` | Build frontend |

`db:reset` is destructive to the database at `DB_PATH`; it does not delete other files.

## Environment

Copy `.env.example` to `.env`. `.env` is ignored by Git.

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | API port | `3001` |
| `CLIENT_URL` | Allowed browser origin for CORS | `http://localhost:5173` |
| `SERVER_URL` | API base URL | `http://localhost:3001` |
| `JWT_SECRET` | JWT signing secret (required) | — |
| `DB_PATH` | SQLite database file | `server/db/shusthobazaar.db` |
| `UPLOAD_DIR` | Private folder for uploaded prescriptions (not served statically) | `server/uploads` |

No SSLCommerz credentials are used. The mock payment screen never asks for card numbers, wallet credentials, or PINs.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | `customer@shusthobazaar.demo` | `Customer123!` |
| Seller (Lazz Pharma Dhanmondi) | `seller@shusthobazaar.demo` | `Seller123!` |
| Seller (Tamanna Pharmacy Mirpur) | `seller2@shusthobazaar.demo` | `Seller2123!` |
| Admin | `admin@shusthobazaar.demo` | `Admin123!` |

The second pharmacy and its account are created by the seed. A database created before it was added needs `npm run db:reset` to get them. These are public local-development accounts. Passwords are bcrypt-hashed in the database, but the values are also included in the frontend for quick-fill; never reuse them or treat this demo as production authentication.

## Payment behavior

Checkout supports Cash on Delivery and a local **Mock payment**. The mock screen has success and decline actions. Results are saved in the `payments` table (`method=mock`, `status=pending|success|failed`); repeated success is idempotent and a failed mock can be retried. COD payments become successful when an authorized seller/admin marks the order delivered.

For multi-seller carts, checkout creates one order per seller and applies the flat ৳60 delivery fee to each seller order. Coupon discounts are calculated server-side and allocated proportionally across those orders. Prices and totals are sent to the frontend in Taka and stored in SQLite as integer paisa.

## Multi-vendor sellers

Each product belongs to one pharmacy (`products.seller_id`). The seed creates two pharmacies: Lazz Pharma Dhanmondi (14 products) and Tamanna Pharmacy Mirpur (8 products), so one cart can span vendors and checkout splits it into one order per pharmacy.

The seller console (`/seller/*`) is backed by the API:

- **Dashboard**: paid earnings, earnings awaiting payment (COD not yet delivered, unpaid mock), open/new/delivered/rejected orders, orders waiting on a prescription check, low-stock alerts, top products and six months of sales.
- **Products**: create, edit price/stock/reorder level/category/Rx flag, hide or list, and delete. A product with order history cannot be deleted, only hidden.
- **Orders**: a seller sees and acts on only its own pharmacy's orders. It can advance the status, or reject a placed/confirmed order with a reason the customer sees; rejection returns the units to stock.

Admins use the same screens with a pharmacy picker and can view the whole marketplace. Seller self-registration and admin approval of pharmacies are not part of this feature.

## Prescription upload and verification

Products marked prescription-only add a **Prescription** step to checkout. The customer drags in or picks a JPEG, PNG or PDF (5 MB max), previews it, uploads it, or chooses one they uploaded before. Checkout is refused without one.

- The server identifies the file from its content (magic bytes), not its name or MIME type, stores it under a random name in `UPLOAD_DIR`, and serves it only through `GET /api/prescriptions/:id/file` to its owner, admins, and the pharmacies whose orders it is attached to.
- Each pharmacy order with Rx items gets its own review (`order_prescriptions`), so in a multi-pharmacy cart every pharmacy checks the prescription for its own items.
- A seller cannot confirm an order with Rx items until it approves the prescription. Rejecting the prescription requires a reason; the customer sees it on the order page and can send a new prescription for another review. The seller can also reject the whole order.

Verification is a manual check by pharmacy staff; the platform does not validate prescriptions medically.

## API

All endpoints return JSON except that the mock payment screen is a frontend route. Authentication uses the `httpOnly` `sb_session` cookie (also accepts `Authorization: Bearer <JWT>`). Authenticated customer endpoints are scoped to that customer; seller order views and status updates are scoped to their pharmacy; admins can access all orders.

| Method | Path | Access / purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Register a customer |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/me` | Current session |
| `GET` | `/api/products?q=&category=&page=&limit=` | Search/filter paginated catalogue |
| `GET` | `/api/products/:id` | Product detail |
| `GET` | `/api/categories` | Categories |
| `GET` | `/api/cart` | Customer's active cart |
| `POST` | `/api/cart/items` | Add `{ "productId": "p001", "quantity": 1 }` |
| `PATCH` | `/api/cart/items/:productId` | Set `{ "quantity": 2 }` |
| `DELETE` | `/api/cart/items/:productId` | Remove an item |
| `DELETE` | `/api/cart` | Clear items and coupon |
| `POST` | `/api/cart/coupon` | Apply `{ "code": "WELCOME10" }` |
| `DELETE` | `/api/cart/coupon` | Remove coupon |
| `GET` | `/api/addresses` | Customer's addresses |
| `POST` | `/api/addresses` | Add a delivery address |
| `POST` | `/api/checkout` | Create seller-split orders, COD or mock |
| `GET` | `/api/orders` | Customer's, seller's, or admin's orders |
| `GET` | `/api/orders/:id` | Order details and status history |
| `PATCH` | `/api/orders/:id/status` | Seller/admin advances `placed` → `confirmed` → `out_for_delivery` → `delivered` |
| `GET` | `/api/orders/:id/invoice` | Generate if needed and return invoice JSON |
| `POST` | `/api/payments/mock/complete` | Persist mock `{ "checkoutReference": "...", "result": "success" }` or `"failed"` |
| `POST` | `/api/orders/:id/reject` | Seller/admin rejects a placed or confirmed order `{ "reason": "..." }` and restocks it |
| `POST` | `/api/orders/:id/prescription` | Customer attaches a new prescription `{ "prescriptionId": "RX-000002" }` after a rejection |
| `GET` | `/api/seller/stores` | Admin: list pharmacies |
| `GET` | `/api/seller/dashboard?sellerId=` | Seller (own pharmacy) or admin (one or all): metrics and earnings |
| `GET` | `/api/seller/products?sellerId=` | Seller/admin inventory, including hidden products |
| `POST` | `/api/seller/products` | Create a product (admins must pass `sellerId`) |
| `PATCH` | `/api/seller/products/:id` | Update price, stock, reorder level, Rx flag, listing, etc. |
| `DELETE` | `/api/seller/products/:id` | Delete a product that has never been ordered |
| `POST` | `/api/prescriptions` | Customer uploads `multipart/form-data` field `file` (JPEG/PNG/PDF, 5 MB) |
| `GET` | `/api/prescriptions` | Customer's uploaded prescriptions and their review results |
| `GET` | `/api/prescriptions/:id/file` | The file, for its owner, linked pharmacies and admins |
| `GET` | `/api/prescriptions/reviews?status=` | Seller/admin verification queue |
| `PATCH` | `/api/prescriptions/reviews/:orderId` | Seller/admin `{ "decision": "approved" }` or `{ "decision": "rejected", "reason": "..." }` |

`POST /api/checkout` also accepts `prescriptionId`, which is required when the cart contains prescription-only products.

The example request collection in [`api.http`](./api.http) covers the API. Seed coupons are `WELCOME10` (10% off, ৳50 minimum) and `SAVE50` (৳50 off, ৳200 minimum).

## Database notes

`server/db/schema.sql` is the SQLite schema adapted from [`shusthobazaar_schema.sql`](./shusthobazaar_schema.sql). It contains only the tables used for accounts, catalogue, carts, orders, payment, and invoices. As agreed for frontend compatibility, it adds `recipient`, `phone`, and `postal_code` to addresses, `coupon_id` to carts, and `checkout_reference` to payments. Address coordinates default to a Dhaka map point because the existing form does not collect coordinates.

Prescription tables live in `server/db/migrations/001_prescriptions.sql`. Unlike the reference schema, the review status is stored per order in `order_prescriptions` (one review per pharmacy) rather than on `prescriptions`. `orders.rejection_reason` was added for seller rejections. Migrations are idempotent and run on every start, so an existing database is upgraded in place.

SQLite foreign keys and WAL mode are enabled on the server connection. Seed data includes the three demo roles, four demo accounts (two sellers), two pharmacies, six categories, 22 products, local image paths, and two coupons.

## Project structure

```text
.
├── public/                 # Static assets and medicine images
├── server/
│   ├── config/
│   ├── db/                 # SQLite schema, migration, seed and reset
│   └── src/                # NestJS controllers, guards and TypeScript API
├── src/
│   ├── components/
│   ├── context/            # API-backed auth, catalogue, cart and addresses
│   ├── data/               # Public demo-account quick-fill
│   ├── layouts/
│   ├── pages/
│   └── routes/
├── .env.example
├── api.http
├── package.json
├── vite.config.js
└── README.md
```

## Not implemented

Real SSLCommerz integration, doctors, appointments, notifications, analytics exports, seller self-registration, and admin verification of pharmacies are intentionally out of scope. Rejecting an order does not refund a successful mock payment.
