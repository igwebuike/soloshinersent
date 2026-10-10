# Shipping integration requirements

This is a static prototype; no live shipping rates are calculated.

Integrate Stripe Checkout plus a shipping-rate provider (e.g., Shippo, EasyPost, ShipStation or direct USPS/UPS/FedEx APIs) on a secure backend. Collect recipient address, validate it, determine origin shipping ZIP (confirm physical shipping origin, do not assume PO Box), calculate actual packed weight/dimensions for each candle and packaging, request USPS/UPS/FedEx quotes, present selected service/rate, and create the shipping label after payment. Configure shipping taxes as appropriate. Never expose carrier API keys in client-side HTML.

Services: USPS Ground Advantage, USPS Priority Mail, USPS Priority Mail Express; UPS Ground, UPS 2nd Day Air; FedEx Home Delivery, FedEx 2Day. Customer reference prices: USPS Ground $8.40, Priority $11.50, Express $37.05 (examples only). Overnight and local delivery require manual confirmation before payment.

Processing: ready-made 3–5 business days; custom confirmed per order. Delivery time starts after dispatch.
