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

The website and Android assets must be kept in sync when editing. Email-link verification is still present; private-device access without sign-in has not been implemented. Live authenticated orders and writes remain unverified. Historical migration scripts and diagnostic screenshots are not runtime source files and are excluded.
