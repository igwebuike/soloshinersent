# Shiner Scents Admin Design

## Intent

Turn the existing single-file storefront into a Render-hosted site that Serrell can manage through a simple, password-protected admin dashboard. She should manage products with ordinary forms and photo uploads; she should never need to write SQL or work directly with a database.

## Goals

- Preserve the existing Shiner Scents storefront identity and content while loading products from persistent storage.
- Provide a secure sign-in and a clear dashboard for adding, editing, publishing, hiding, and removing products.
- Support product name, description, category, price, availability/publication status, and uploaded product photo.
- Keep the site, application server, PostgreSQL database, and uploaded images on Render.
- Include the six products already in the site as initial database records.
- Provide a practical deployment/setup guide that explains the one-time Render configuration and how Serrell signs in and manages products.

## Non-goals

- Online payment checkout, order fulfillment, inventory counts, order management, or customer accounts.
- A general-purpose page builder or editing every block of storefront copy.
- Supabase or another external backend/storage provider.

## Constraints and assumptions

- The current project is a static HTML/CSS/JavaScript storefront with local product photos under `assets/`.
- Render hosts a Node.js web service and PostgreSQL database; a Render persistent disk stores uploaded photos across deploys.
- The initial admin account is provisioned securely during deployment. Public self-registration is disabled.
- Product edits are performed through a responsive visual dashboard using fields, upload controls, and save/publish buttons. Database details are hidden from the admin user.
- The existing email inquiry cart remains as-is; online checkout is out of scope.

## Approaches

1. **Render Node.js service + Render PostgreSQL + Render persistent disk (selected).** Keep the storefront, API, admin, database, and image storage in the Render setup. This directly meets the requirement to use Render and keeps editing in one dashboard.
2. **Static storefront + Supabase.** This would provide hosted authentication and storage, but adds an outside backend provider and was declined.
3. **Static product data files.** This avoids a database but does not safely provide account-based product management, so it does not meet the goal.

## Design

Convert the site to an Express application that serves the public storefront, admin interface, product API, and uploaded images. Store product records in PostgreSQL. Save uploaded image files under a configurable persistent-disk directory and store their public paths with product records. Add authenticated admin routes for product create, update, publish/unpublish, and delete. Public product queries return only published products. Validate inputs and uploaded image type/size on the server.

The admin interface should use plain-language fields and clear actions. The user signs in, sees the product list, chooses “Add product” or “Edit,” enters a title and description, sets price/category/availability, uploads a photo, and saves or publishes. Authentication uses a secure hashed password, protected sessions, and no public sign-up. Deployment instructions cover the Render service, PostgreSQL, disk mount, environment variables, initial account provisioning, and sign-in URL.

## Approval

Approved by the user on 2026-10-23. The user specifically confirmed: “no supabase just on render” and clarified that Serrell must be able to upload products and enter descriptions through the backend without SQL or database technicalities.
