# Product certificates

Run database/certificates.sql once in the existing Supabase SQL Editor.
It adds a separate certificate registry and administrator-only issuance/revocation.
It does not change orders or inventory.

Open Certificates & QR in the admin panel, choose Register item, select a product,
enter a buyer display name with permission, purchase date and optional edition,
order UUID and message. Register each physical item separately.
Download or print the QR label and attach it to that item.
The label opens https://www.animekingdom.in/verify.html with its unique code.
Buyers can view and print/save the certificate as PDF.

Serial numbers start at 101; database sequences can have gaps.
Revoke invalid registrations in the admin panel. Revoked QR codes stop showing
a certificate. Public lookup exposes only certificate display information,
never customer contact information or order details.

This is an Anime Kingdom seller registration, not independent manufacturer
authentication. QR labels can be copied, so compare the item and serial with
the store record when investigating suspected copies.
