# Anime Kingdom Admin

Standalone admin website for animekingdom.in.

Deploy as a static website with index.html at the root. No build command is required. Publish directory: .

Uses the existing Supabase store database. Public catalog and coupons load without sign-in. Orders and mutations require an authorized administrator session. A separate domain does not replace database access controls.

No private keys, customer exports, or Android signing files are included.
