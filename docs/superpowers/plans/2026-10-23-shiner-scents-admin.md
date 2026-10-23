# Shiner Scents Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static product list with a Render-backed storefront and a polished, password-protected dashboard where Serrell can manage products without SQL.

**Architecture:** A Node.js/Express service serves the storefront, admin pages, API, and uploaded product images. Render PostgreSQL stores product records and sessions; a Render persistent disk stores uploaded images. The public site reads published products from the API, while authenticated admin routes support CRUD and publication controls.

**Tech Stack:** Node.js, Express, PostgreSQL (`pg`), server-side sessions, bcrypt password hashing, Multer image uploads, HTML/CSS/vanilla JavaScript, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-23-shiner-scents-admin-design.md`

## Global Constraints

- Host the web service, PostgreSQL database, and persistent image disk on Render.
- Keep product management visual and form-based; Serrell must not need SQL or database access.
- Keep public self-registration disabled; provision the first admin account securely.
- Public product listings show only published products.
- Preserve the existing storefront design, brand copy, and email inquiry cart.
- Do not add payment checkout, order fulfillment, or order management.

## Review Focus

- Missing or weak deployment secrets must fail closed; test required environment validation and safe startup behavior in Task 1.
- Unauthenticated requests must never read private admin data or mutate products; test protected API routes in Task 2/3.
- Empty/invalid prices, missing names, and malformed product fields must produce readable validation errors; test product validation in Task 3.
- Oversized or non-image uploads must be rejected without creating files; test upload filtering and size limits in Task 3.
- Replacing/deleting a product photo must not break the product or leave stale files; test upload lifecycle in Task 3.

---

### Task 1: Establish the Render application and persistent data model

**Files:**
- Create: `package.json`
- Create: `src/config.js`
- Create: `src/db/pool.js`
- Create: `src/db/migrate.js`
- Create: `src/db/seed.js`
- Create: `src/db/schema.sql`
- Create: `tests/config.test.js`
- Modify: `index.html` (later task owns storefront integration; leave product markup intact here)

**Interfaces:**
- Produces `loadConfig(env)`, `getPool(config)`, `runMigrations(pool)`, and `seedInitialProducts(pool)`.
- Product fields: `id`, `name`, `description`, `category`, `price_cents`, `image_path`, `is_available`, `is_published`, `created_at`, `updated_at`, and `sort_order`.

- [ ] **Step 1: Write failing configuration tests** for required database URL, session secret, upload directory, valid production cookie settings, and rejection of a short/missing session secret.
- [ ] **Step 2: Run** `npm test -- tests/config.test.js`; confirm the configuration tests fail because the service modules do not exist.
- [ ] **Step 3: Add the Express application shell, PostgreSQL connection, migration, and config validation.** Make startup verify schema and required secrets before listening. Define a products table with cents-based prices and indexes for published/sort order.
- [ ] **Step 4: Add initial seeding** for the six product records currently hard-coded in `index.html`, preserving their current names, descriptions, prices, and image paths.
- [ ] **Step 5: Run** `npm test -- tests/config.test.js`; expected: all config tests pass. Run `node --check src/config.js && node --check src/db/migrate.js && node --check src/db/seed.js`; expected: syntax checks pass. Run the full `npm run check` after Task 5 creates the server, storefront, and admin scripts.

### Task 2: Add secure admin authentication and session handling

**Files:**
- Create: `src/auth/passwords.js`
- Create: `src/auth/session.js`
- Create: `src/auth/routes.js`
- Create: `src/auth/require-admin.js`
- Create: `tests/auth.test.js`

**Interfaces:**
- `hashPassword(password)` and `verifyPassword(password, hash)` use bcrypt.
- `requireAdmin(req, res, next)` permits only an authenticated session.
- `POST /api/admin/login`, `POST /api/admin/logout`, and `GET /api/admin/session` form the admin auth API.

- [ ] **Step 1: Write failing tests** for password hashing/verification, login success/failure, session state, logout, and unauthenticated admin access.
- [ ] **Step 2: Run** `npm test -- tests/auth.test.js`; confirm the new tests fail before implementation.
- [ ] **Step 3: Implement** hashed-password verification, PostgreSQL-backed sessions, secure HTTP-only SameSite cookies, login rate limiting, and admin-only middleware. Create the first account from deployment environment values if absent; do not expose a public registration route.
- [ ] **Step 4: Run** `npm test -- tests/auth.test.js`; expected: all auth tests pass and unauthenticated access returns 401.

### Task 3: Implement product CRUD and persistent image uploads

**Files:**
- Create: `src/products/validation.js`
- Create: `src/products/repository.js`
- Create: `src/products/routes.js`
- Create: `src/uploads/storage.js`
- Create: `tests/products.test.js`
- Create: `tests/seed.test.js`
- Create: `src/errors.js`
- Create: `tests/uploads.test.js`

**Interfaces:**
- `validateProduct(input)` returns normalized product fields or field-level errors.
- `listPublishedProducts()`, `listAdminProducts()`, `createProduct(input)`, `updateProduct(id, input)`, `setProductPublished(id, published)`, and `deleteProduct(id)` are repository operations.
- `GET /api/products` is public and returns published products only.
- Authenticated `/api/admin/products` routes list/create/update/delete products and toggle publication.
- Image upload accepts JPEG, PNG, and WebP up to 8 MiB, writes a generated safe filename under `UPLOAD_DIR`, and returns its `/uploads/<filename>` path.

- [ ] **Step 1: Write failing tests** for valid/invalid product fields, cents conversion, published-only public reads, admin CRUD, image MIME/size rejection, safe filename creation, and cleanup after replace/delete.
- [ ] **Step 2: Run** `npm test -- tests/products.test.js tests/uploads.test.js`; confirm failures before implementation.
- [ ] **Step 3: Implement** repository operations, field validation, authenticated routes, and disk-backed image storage. On photo replacement or product deletion, remove the prior uploaded photo after the database update succeeds; never delete bundled `/assets/` photos.
- [ ] **Step 4: Run** the targeted tests; expected: all CRUD, publication, validation, and upload tests pass.

### Task 4: Build the visual admin dashboard

**Files:**
- Create: `admin/index.html`
- Create: `admin/admin.css`
- Create: `admin/admin.js`
- Create: `admin/login.html`
- Create: `admin/login.js`
- Create: `assets/product-placeholder.svg`
- Create: `src/app.js`
- Create: `server.js`
- Create: `tests/admin-ui.test.js`

**Interfaces:**
- `GET /admin/login` serves the login page; `GET /admin` serves a protected dashboard shell.
- The dashboard uses the auth and product APIs from Tasks 2–3.
- Product editor fields: product name, description, category, price, available toggle, published toggle, and photo upload.

- [ ] **Step 1: Write failing UI smoke tests** that assert routes exist, form labels are plain language, photo input accepts supported image types, and the page exposes add/edit/save/publish/hide/delete actions.
- [ ] **Step 2: Run** `npm test -- tests/admin-ui.test.js`; confirm failures.
- [ ] **Step 3: Implement** responsive login and dashboard pages with a refined plum, warm cream, and gold visual system matching Shiner Scents. Use clear save/publish feedback and confirmation before deleting; do not surface SQL, database settings, or technical identifiers.
- [ ] **Step 4: Run** the UI smoke tests and verify at desktop and mobile widths; expected: all required controls are present and usable.

### Task 5: Connect the public storefront to database products

**Files:**
- Modify: `index.html`
- Create: `public.js`
- Create: `tests/storefront.test.js`
- Modify: `tests/admin-ui.test.js` (exercise the product form in a DOM)

**Interfaces:**
- The storefront fetches `GET /api/products` and renders returned records using escaped text and safe image paths.
- The existing collection, story, care sections, customization modal, cart, and email inquiry behavior remain available.

- [ ] **Step 1: Write failing tests** for rendering published products from the API, empty/error states, safe text rendering, and continued cart/email inquiry behavior.
- [ ] **Step 2: Run** `npm test -- tests/storefront.test.js`; confirm failures.
- [ ] **Step 3: Replace** the hard-coded `products` array with API-backed rendering and preserve current storefront styling and cart interactions.
- [ ] **Step 4: Run** the storefront tests; expected: products load from API, hidden products do not display, and inquiry cart still works.

### Task 6: Prepare Render deployment and deliverable

**Files:**
- Create: `render.yaml`
- Create: `.env.example`
- Create: `README.md`
- Create: `scripts/validate-render-config.js`
- Create: `tests/deployment.test.js`
- Modify: `package.json` and `package-lock.json` for local checks and deployment validation

- [ ] **Step 1: Write failing deployment checks** for required Render service/database/disk configuration, environment documentation, and first-admin setup instructions.
- [ ] **Step 2: Run** `npm test -- tests/deployment.test.js`; confirm failures.
- [ ] **Step 3: Add** Render Blueprint configuration for the web service, PostgreSQL, and persistent disk; document initial admin provisioning, service URL, dashboard sign-in, product upload/edit/publish workflow, deployment, and backup considerations in plain language.
- [ ] **Step 4: Run** `npm test`, `npm run check`, and a local smoke test with a PostgreSQL test database; expected: all tests pass and storefront/admin/API routes start and respond correctly.
- [ ] **Step 5: Package** the complete application as an updated ZIP, preserving all supplied product photos and storefront assets.

---
