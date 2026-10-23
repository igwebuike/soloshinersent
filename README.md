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

This lower-cost setup creates one small Render Node web service and a 1 GB persistent disk. SQLite stores products, the admin account, and login sessions on that disk; uploaded product photos use the same disk. This avoids a separate PostgreSQL charge while keeping the catalog and photos across restarts and deploys. Render's current estimate is about $7.25/month ($7 service + $0.25 for 1 GB disk), before usage-based charges. Persistent disks require a paid web-service plan, support one service instance, and cause a short interruption during deploys. See [Render persistent disk details](https://render.com/docs/disks).

1. Put the contents of this project folder in the GitHub repository that Render should deploy. Keep `render.yaml` at the repository root.
2. In Render, create a new Blueprint and connect that repository. Render will show the web service and disk it is about to provision. Review the plan before deploying.
3. Enter the initial admin email and a strong password when Render asks for `ADMIN_EMAIL` and `ADMIN_PASSWORD`. These values are private Render settings and are never stored in this source file. Render generates the session secret automatically.
4. Wait for the service's `/healthz` check to pass. Open the service URL and confirm the storefront loads; then open `/admin/login` and sign in with the credentials from step 3.

The first service start creates the database tables and inserts the six starter products. It creates the first admin account only when the database has no admin account. Later deploys do not reset the existing password.

If the current Render website is a Static Site, this Blueprint creates a separate Web Service because Render service types cannot be changed after creation. Test the new service first, then move the custom domain from the old Static Site to the new service in Render. Keep the old site until that switch is complete.

## Local checks

- `npm ci` installs the locked dependencies.
- `npm test` runs the unit and integration tests with in-memory SQLite.
- `npm run check` checks JavaScript syntax.
- `npm run render:check` validates the Render Blueprint before provisioning.

For local development, copy `.env.example` to `.env` and replace the sample session/admin values. The app creates the SQLite database at `DATABASE_PATH`; make sure its parent directory exists. Do not commit `.env` or share the initial admin password in source control.

Product records, admin login, and sessions are stored in `/var/data/shiner-scents.sqlite`; uploaded photos are stored under `/var/data/uploads`. Both survive restarts and deploys while the persistent disk stays attached. Keep the disk attached and retain its snapshots when managing the service. Render snapshots persistent disks daily; its [disk guide](https://render.com/docs/disks) explains the limits and restore behavior.
