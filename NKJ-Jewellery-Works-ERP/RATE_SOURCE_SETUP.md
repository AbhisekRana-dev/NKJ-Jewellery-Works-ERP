# Kolkata Gold & Silver Rate Import

## Current implementation and source-access requirement

The backend runs the daily rate importer at **06:15 Asia/Kolkata**. It checks sources in this order:

1. **Anandabazar Patrika Kolkata edition** — only through an authorized feed adapter.
2. **All India Bullion · Kolkata** — optional fallback, also only through an authorized feed adapter.

The application does not scrape subscriber e-paper pages, scrape vendor pages, use random search results, or substitute India-wide prices for Kolkata. If neither authorized feed is configured, the scheduled task records `NO_AUTHORIZED_KOLKATA_SOURCE`, and existing verified prices remain active.

This distinction is important:
- Anandabazar Patrika e-paper is subscriber-controlled. Its website terms restrict systematic downloading/extraction of site pages and price data without prior written permission.
- All India Bullion publishes a Kolkata-specific rate page and a free embed widget, but its current terms prohibit scraping, copying or republishing rates without written permission. The widget is an iframe for display; it is not a backend JSON API and cannot be used to populate this ERP database.
- The All India Bullion Kolkata page describes 24K / 22K gold values per 10 grams and 999 silver per kilogram. It describes 22K as derived from 24K and labels the data an indicative local reference, not a final jewellery invoice.

Obtain written permission and a feed/API endpoint before enabling either source. If you only have the public AIB widget code, it may be embedded in a website for display under its credit-link conditions, but it does not replace an authorized backend feed for the ERP history or invoice rate store.

## Environment configuration

Add these variables to the backend environment file or deployment secret settings. Never put API credentials in React or commit the secret values to Git.

```properties
# Preferred source
ABP_RATE_FEED_ENABLED=true
ABP_RATE_FEED_URL=https://YOUR-AUTHORIZED-ANANDABAZAR-ADAPTER/daily-rates
ABP_RATE_FEED_API_KEY=YOUR_SECRET

# Kolkata-specific fallback
AIB_RATE_FEED_ENABLED=true
AIB_RATE_FEED_URL=https://YOUR-AUTHORIZED-KOLKATA-FEED/daily-rates
AIB_RATE_FEED_API_KEY=YOUR_SECRET
```

The fallback can be disabled by leaving `AIB_RATE_FEED_ENABLED=false`. The backend then keeps existing rates when the Anandabazar adapter is unavailable.

## JSON contract for each authorized feed

Both adapters must normalize their output to this JSON contract:

```json
{
  "city": "Kolkata",
  "publicationDate": "2026-11-06",
  "publishedAt": "2026-11-06T23:36:00+05:30",
  "unit": "PER_10_GRAMS",
  "gold24k": 145941.00,
  "gold22k": 133682.00,
  "silver999": 1905.41,
  "sourceReference": "https://SOURCE-DOMAIN/KOLKATA-ISSUE-OR-RATE-SNAPSHOT"
}
```

Requirements:
- `city` must be exactly Kolkata (case-insensitive); other cities are rejected.
- `publicationDate` is the source original rate date and must not be in the future or more than three calendar days old.
- `publishedAt` is the actual source snapshot/publication time in Kolkata time or an offset-aware ISO timestamp.
- `unit` must be `PER_10_GRAMS` or `PER_GRAM`; all three fields must use the same unit. The adapter for AIB must convert its published silver-per-kilogram reading to per 10 grams before returning the contract.
- All three values must be positive numeric values.
- `sourceReference` must point to the exact source issue/rate page and use the source domain. Anandabazar data must reference `anandabazar.com`; the AIB fallback must reference `allindiabullion.com`.
- The ERP assigns the source label from the configured adapter. It never labels the fallback as Anandabazar Patrika.

## Automatic mode

- Runs once daily at **06:15 Asia/Kolkata**.
- Checks Anandabazar first; if it is unavailable, invalid, or has no newer publication, checks the authorized Kolkata fallback.
- Rejects non-Kolkata, future-dated, stale, incomplete or duplicate publication snapshots.
- Stores one import for each new source publication date; repeated scheduler/manual Auto checks for the same publication date do not duplicate history.
- Values are displayed per 10 grams and are stored internally per gram to preserve existing invoice calculations.
- Source name, source URL/reference, original publication date/time, and imported values are saved in the rate history.
- A source failure updates only fetch status; it does not alter active rates or their original rate date.

## Manual Override Mode

1. Sign in as the owner (password plus authenticator OTP).
2. Open **Gold & Silver Rates**.
3. Enter 24K, 22K and 999 Silver values in ₹ per 10 grams.
4. Select **Save Manual Rates**. The mode becomes `MANUAL`.
5. The automatic job skips imports until the owner selects **Switch to Automatic Mode**.
6. On switching back, the system restores the latest saved automatic snapshot (when available) and immediately checks the authorized feeds.

Each manual rate update is saved with the administrator identity, current Kolkata date/time, values and source label `Manual Admin Entry`.

## Daily Rate History

The history stores automatic imports and each manual rate update. The page displays each history row actual 24K gold, 22K gold, 999 silver values, the original rate date, source, time and actor. It does not display a previous-rate-to-new-rate comparison. Existing legacy history rows are preserved.

## Rate interpretation

All India Bullion published city page describes its values as indicative reference rates. Its page identifies 24K / 22K per 10g and 999 silver per kg; 22K is derived from the 24K/999 metal reference. These values are not final jewellery sale prices. Making charges, wastage, GST and shop-specific pricing remain governed by the existing invoice workflow.
