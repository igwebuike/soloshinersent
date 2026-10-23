# Shiner Scents Product Studio

Shiner Scents is a Render-hosted candle storefront with a private product dashboard. Serrell can add, update, publish, hide, and remove products through ordinary forms. She can upload a photo and write each description herself; she does not need SQL or database access.

The site starts with the six products from the supplied storefront. The public shop keeps its existing brand story, candle care, customization choices, bag, and email order inquiry.

## For Serrell: updating products

1. Open the shop's `/admin/login` address and sign in with the email and password provided to you.
2. Choose **Add product** or **Edit** beside an existing product.
3. Enter the product name, description, category, and price. Upload a JPEG, PNG, or WebP photo (up to 8 MiB).
4. Choose whether the product is available to order and whether it should appear on the storefront.
5. Select **Save product** or **Save changes**. Use **Delete** to remove a product.

Products marked **Published** appear in the public shop. Hidden products remain in the dashboard so they can be published later. The storefront bag continues to collect inquiries by email; online payment is not configured.

## One-time Render setup

This setup creates a Render Node web service, a Render PostgreSQL database, and a persistent disk for uploaded product photos. The disk requires a paid Render web-service plan. The service and database are in the same Render region. The upload disk is configured for one service instance; Render does not allow a disk-backed service to scale to multiple instances. Deploys that use a persistent disk can have a short interruption while Render replaces the instance. See [Render persistent disk details](https://render.com/docs/disks).

1. Put the contents of this project folder in the GitHub repository that Render should deploy. Keep `render.yaml` at the repository root.
2. In Render, create a new Blueprint and connect that repository. Render will show the web service, database, and disk it is about to provision. Review the plan before deploying.
3. Enter the initial admin email and a strong password when Render asks for `ADMIN_EMAIL` and `ADMIN_PASSWORD`. These values are private Render settings and are never stored in this source file. Render generates the session secret automatically.
4. Wait for the service's `/healthz` check to pass. Open the service URL and confirm the storefront loads; then open `/admin/login` and sign in with the credentials from step 3.

The first service start creates the database tables and inserts the six starter products. It creates the first admin account only when the database has no admin account. Later deploys do not reset the existing password.

If the current Render website is a Static Site, this Blueprint creates a separate Web Service because Render service types cannot be changed after creation. Test the new service first, then move the custom domain from the old Static Site to the new service in Render. Keep the old site until that switch is complete.

## Local checks

- `npm ci` installs the locked dependencies.
- `npm test` runs the unit and integration tests with a PostgreSQL-compatible in-memory test database.
- `npm run check` checks JavaScript syntax.
- `npm run render:check` validates the Render Blueprint before provisioning.

For local development, copy `.env.example` to `.env`, set a PostgreSQL `DATABASE_URL`, and replace the sample session/admin values. Do not commit `.env` or share the initial admin password in source control.

Product records are stored in Render PostgreSQL. Uploaded photos are stored under `/var/data/uploads` on the Render persistent disk, so they survive restarts and deploys. Keep the disk attached and retain its snapshots when managing the service. Render snapshots persistent disks daily; its [disk guide](https://render.com/docs/disks) explains the limits and restore behavior.
