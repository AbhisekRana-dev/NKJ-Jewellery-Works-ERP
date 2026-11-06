# Kolkata Gold & Silver Rate Sources

## Source order

The daily backend job runs once at **06:15 Asia/Kolkata** and uses this source order:

1. **Anandabazar Patrika Kolkata edition** — only when an authorized adapter URL is configured. The application does not bypass its e-paper subscription or claim access to a public publisher API.
2. **All India Bullion — Kolkata** — public city snapshot fallback at
   https://allindiabullion.com/gold-rate/west-bengal/kolkata

The fallback publishes a Kolkata-specific 24K and 22K gold reference in ₹/10 grams and 999 silver in ₹/kilogram. The importer converts silver to ₹/10 grams and stores all three metals internally per gram for the existing invoice calculations. The ERP labels this source **All India Bullion · Kolkata**, never Anandabazar Patrika. The provider describes these prices as indicative bullion reference rates, not a binding offer or a final jewellery invoice.

Source methodology:
https://allindiabullion.com/rate-methodology

## Anandabazar adapter (optional, preferred)

The Anandabazar e-paper is subscriber-controlled. Do not scrape subscriber-only pages or bypass access restrictions. To use the preferred source, configure an authorized feed adapter that you are permitted to access and reuse:

```properties
ABP_RATE_FEED_ENABLED=true
ABP_RATE_FEED_URL=https://YOUR-AUTHORIZED-ADAPTER-ENDPOINT/daily-rates
ABP_RATE_FEED_API_KEY=YOUR_ADAPTER_KEY
```

The adapter must return a JSON document in this format:

```json
{
  "publicationDate": "2026-11-07",
  "publishedAt": "2026-11-07T06:00:00",
  "unit": "PER_10_GRAMS",
  "gold24k": 146500.00,
  "gold22k": 134500.00,
  "silver999": 1450.00,
  "sourceReference": "Exact Anandabazar Patrika Kolkata edition URL or issue reference"
}
```

`unit` can be `PER_10_GRAMS` or `PER_GRAM`. `publishedAt` must be Kolkata-local or an offset-aware timestamp. The three rates and exact issue reference are mandatory.

If the Anandabazar adapter is disabled, unavailable, invalid, or has no newer publication, the daily job attempts the Kolkata fallback. A source is never labelled as Anandabazar unless it came through the configured Anandabazar adapter.

## Automatic update behavior

- Scheduled once each day at 06:15 in `Asia/Kolkata`.
- An authorized Anandabazar adapter is tried first; All India Bullion Kolkata is the fallback.
- Only explicit Kolkata snapshots with all three metal values and a source publication timestamp are accepted.
- A publication date cannot be in the future or older than the last automatically imported publication date.
- Automatic imports are serialized against manual updates and deduplicated by publication date.
- Manual Override Mode blocks all automatic overwrites.
- Switching back to Automatic Mode immediately restores the latest previously imported automatic snapshot, then checks the sources.
- If no source returns a newer valid snapshot, the last verified prices and their original rate date remain active.
- Failed or stale source responses update fetch status only; they do not alter active prices or rate history.

## Manual override and rate units

1. Sign in as the owner (password plus authenticator OTP).
2. Open **Gold & Silver Rates**.
3. Enter 24K, 22K and 999 Silver amounts in ₹ per 10 grams and select **Save Manual Rates**.
4. The mode changes to `MANUAL`; the automatic job cannot overwrite these values.
5. Use **Switch to Auto Mode** to restore the latest saved automatic snapshot and immediately fetch newer published values.

The database and existing invoice calculations continue to store rates per gram. The management page and public rate board display ₹ per 10 grams.

## Daily Rate History

Every successful automatic import and manual rate change is saved with its actual rate values, source, publication date where available, and change timestamp. The history UI displays the saved values directly; it does not show a previous-rate-to-new-rate comparison.

## Provider note

All India Bullion's Kolkata page calls its prices indicative reference rates and says final jewellery prices may differ due to local seller pricing, GST and charges. Confirm the final sale quote with the shop's pricing policy. The ERP preserves the provider name and page reference for audit and traceability.
