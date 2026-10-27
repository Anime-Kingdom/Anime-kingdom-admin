# Anime Kingdom Admin

Standalone admin website for animekingdom.in.

For hosting imports, select Other / Static website, set the build command to `npm run build`, and set the publish directory to `dist`. No dependencies are required. The build copies only the three website files into `dist`.

You can also deploy directly as a static website with index.html at the root and no build command.

Uses the existing Supabase store database. Public catalog and coupons load without sign-in. Orders and mutations require an authorized administrator session. A separate domain does not replace database access controls.

No private keys, customer exports, or Android signing files are included.

## Full source files

- Root index.html, app.js and style.css: deployable admin website.
- admin-android/android: Android manifest, Java WebView wrapper, icon and bundled website.
- admin-android/setup.sql: database tables, administrator allowlist and access policies. Review before running; the live project has already been configured.
- admin-android/seed-products.sql: initial product catalog; existing entries are not overwritten.
- admin-android/preview.cjs: local preview; run node admin-android/preview.cjs.
- admin-android/test-session.cjs and test-sync.cjs: run from the repository root with Node.js.
- admin-android/build-apk.ps1: Windows Android build. Expects JDK and Android SDK 35 tools under apk-build-tools/java and apk-build-tools/sdk in the repository root. Tools and private signing files are not uploaded.

Edit the root website files and run npm run build to synchronize the Android assets. Password sign-in is enabled; private-device access without sign-in has not been implemented. Live authenticated orders and writes remain unverified. Historical migration scripts and diagnostic screenshots are not runtime source files and are excluded.

## Hosting and maintenance

- Import this repository as a static site, with build command `npm run build` and publish directory `dist`.
- Run `npm run dev` for the local preview. Set `PORT` to use a different local port.
- Edit the root website files. `npm run build` also synchronizes them into the Android assets.
- Run `npm test` before publishing. Tests use simulated orders and do not submit real orders.
- Products support images, original/selling prices, stock, collections and descriptions. Catalog and inventory can be searched, filtered by stock and sorted.
- Orders can be filtered by fulfillment status. Customers are grouped from order records. Coupons support percentage or fixed discounts and minimum order values.
- Public catalog data refreshes every 15 seconds while idle. Orders and saving changes require an authorized administrator session. The panel shows connection errors rather than fabricated order data.
- Set the administrator account password in Supabase Authentication. Passwords are never stored in this repository. Deploying the source alone does not set or reset account credentials.

## Node.js hosting (503 startup fix)

For hosts that run a Node application, use `npm start` (entry file `server.cjs`). The production server listens on `0.0.0.0` and the hosting platform's `PORT`, defaulting to 3000. Health check: `/healthz`. Use Node 18 or newer. Do not use the localhost-only development preview for production. Static hosting can still use `npm run build` and publish `dist`.

After pulling a new commit, redeploy/restart the hosting application. A 503 that persists requires checking the host's deployment logs and start command; a GitHub push alone does not guarantee the host has deployed the change.


## Product studio and customer accounts

The editor supports gallery covers, colour/character options, stable option codes, labels, per-option uploads, swatches, ordering, packs, minimum quantity, material, height, featured/new flags and contact-store availability. Stock remains shared between options. Saves preserve unedited product data.

Sign-ins & accounts reads `ak_admin_customer_accounts` after the existing administrator-role check. Apply `database/customer-activity.sql` once; verification in `database/verify-customer-activity.sql` rolls back test writes. This migration is installed on the current project. Customers record only their own app/website surface through an authenticated RPC. Existing authentication supplies last-sign-in dates. Surface history begins with this release and is not an online-presence count.

Custom requests and messages have separate inboxes. CSV exports escape spreadsheet formula prefixes. Certificates, QR labels, original authentication and existing order tools remain available. New UI assets are included in the server allowlist and Android source asset sync; no Android APK was rebuilt for this update.

## 27 October 2026 admin fixes

The product catalog keeps its table layout across unchanged 15-second refreshes. Product CSV exports include customer-facing descriptions, specifications, options, public images and exact store-app product links; private customer data is not included in product exports. QR tools download PNG images (plus SVG), retain a white quiet zone, and allow cancelling a failed product-list load. The browser chooses Downloads versus Gallery/Photos.

Partner wallets expose an administrator-only future-order commission control. ZYRO and Raggo are configured at 10% in the live database. Private partner reports include item names and quantities without customer contact details, refresh every 15 seconds while visible, and clearly mark unfulfilled orders Not delivered. Existing delivery-only credit, reversal and INR1000 withdrawal checks remain in force. Migrations: database/partner-commission-control.sql and database/partner-live-orders.sql are installed. Historical earnings retain their recorded rates.

Free order alerts poll while the connected admin is open and visible. In-panel alerts need no provider. Browser notifications require the user's browser permission. No SMS or WhatsApp sending, phone-number registration, paid service or background delivery was configured. Tests use simulated or transaction-rolled-back orders; no real orders, deliveries or payments were created.
