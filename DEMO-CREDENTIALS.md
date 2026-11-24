# Public demo credentials

These are public local-development accounts, not production credentials. Their password hashes are inserted into SQLite by `server/db/seed.js`; the same demo values are included in [`src/data/demoAccounts.js`](./src/data/demoAccounts.js) so the login screen can quick-fill them.

| Role | Email | Password |
|---|---|---|
| Customer | `customer@shusthobazaar.demo` | `Customer123!` |
| Seller (Lazz Pharma Dhanmondi) | `seller@shusthobazaar.demo` | `Seller123!` |
| Seller (Tamanna Pharmacy Mirpur) | `seller2@shusthobazaar.demo` | `Seller2123!` |
| Doctor (BMDC Verified) | `dr.farhana@shusthobazaar.demo` | `Doctor123!` |
| Admin | `admin@shusthobazaar.demo` | `Admin123!` |

Never use these credentials for any other service. The API uses JWT sessions and enforces roles, but this seeded demo setup is not intended for production.
