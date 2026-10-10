# Shiner Scents launch checklist

## Current status
This is a static demonstration website. Shopping bag currently sends email inquiries, not paid orders. Instagram is linked in navigation and footer. No payment credentials are included.

## Launch architecture
- Render Static Site: public website and product catalog.
- Render Web Service: secure Node.js backend for checkout sessions, Shippo carrier quotes and webhooks. Never place Stripe or Shippo secret keys in the static site.
- Stripe: checkout, card payment, tax configuration and payment confirmations. Verify payment via webhook before fulfillment.
- Shippo: real-time USPS/UPS/FedEx quotes based on packed weight, dimensions, destination and origin, shipping labels, tracking.
- Optional later: database for inventory, customer profiles, order workflow and persistent custom requests.

## Required before activation
1. Confirm GoDaddy domain and set Render custom-domain DNS records from Render dashboard.
2. Open Stripe account, complete verification, configure taxes, refund policy and webhook.
3. Open Shippo account and get test/live API tokens.
4. Supply physical ship-from street address (not PO Box unless accepted for the carrier), weights and dimensions of fully packed 10.5/12/17.5 oz candles and gift sets.
5. Confirm candle prices, SKU availability, decorative candle prices, shipping regions, contact and return policies.
6. Build and deploy secure backend and implement customer shipping-address input and carrier-rate selection BEFORE checkout payment.
7. Send order confirmation and tracking emails; test successful/failed payments, multi-item parcels, refunds and shipment creation.
8. Enable production keys only after testing.

## Social
Instagram: https://www.instagram.com/soloshiners_ent/
