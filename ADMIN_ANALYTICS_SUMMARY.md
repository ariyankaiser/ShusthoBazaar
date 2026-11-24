powershell -Command "@'
### Summary of Changes (Features 19 & 20)

This branch implements **Feature 19 (Analytics & Reports)** and **Feature 20 (Admin Governance & Verification)** in isolated modules without altering existing customer, seller, or core platform logic.

#### What Was Added
* **Feature 19 — Analytics & Performance Reports (`/admin/analytics`)**
  * Gross revenue, order volume, and checkout conversion rate KPIs with pharmacy-level filtering
  * Customer conversion funnel tracking (Product View -> Cart -> Checkout -> Payment)
  * Daily order revenue breakdown, top-selling medicines table, and downloadable CSV report export (`/api/analytics/export/csv`)
* **Feature 20 — Platform Governance & Verification (`/admin/manage`)**
  * **Seller & Doctor Verification:** Approve or reject pharmacy applications (Drug License & TIN) and doctor credentials (BMDC registration)
  * **User Account Management:** Activate or suspend registered platform accounts
  * **Coupons & Promos:** Create percentage/fixed discount codes and toggle active status
  * **Moderation:** Resolve customer complaints with admin action notes and toggle marketplace review visibility

#### File Breakdown
* **New Isolated Files (7):**
  * `server/db/migrations/002_admin_analytics.sql` — Database schema for doctor verifications, reviews, complaints, and analytics events
  * `server/src/services/analytics.service.ts` & `server/src/controllers/analytics.controller.ts` — Analytics queries and CSV export endpoints (`/api/analytics/*`)
  * `server/src/services/admin.service.ts` & `server/src/controllers/admin.controller.ts` — Admin governance endpoints (`/api/admin/*`)
  * `src/pages/admin/AnalyticsReports.jsx` & `src/pages/admin/AdminControlPanel.jsx` — Admin frontend interfaces
* **Minimal Registration Hooks (3):**
  * `server/src/app.module.ts` — Registered `AnalyticsController` and `AdminController`
  * `src/pages/AdminDashboard.jsx` — Added navigation cards for Analytics and Governance
  * `src/routes/AppRoutes.jsx` — Registered protected admin routes (`/admin/analytics` and `/admin/manage`)

#### How to Test
1. Run `npm run dev:full`
2. Log in at `/login` using `admin@shusthobazaar.demo` / `Admin123!`
3. Open **Analytics and reports** or **Verification and governance** from the Admin Workspace
'@ | Set-Content -Encoding UTF8 'ADMIN_ANALYTICS_SUMMARY.md'"
