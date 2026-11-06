# Daily Anandabazar Patrika Rate Import

## What the application now does

- A Spring scheduled job runs once a day at **06:15 Asia/Kolkata**. The schedule is fixed in code so it cannot be configured to refresh prices multiple times during the day.
- It requests one JSON document from a configured, authorized feed adapter.
- Only a record whose `publicationDate` equals the current Kolkata date may be applied.
- The import runs only while the owner has selected `AUTO` mode.
- Duplicate imports for the same newspaper publication date are ignored.
- A failed request, missing current issue, or invalid payload does not replace the active prices. The last verified rate values and their original `rateDate` remain visible.
- Values are stored internally per gram for existing invoice calculations. The web board/editor display per 10 grams.
- Manual edits are backend protected, require a valid administrator bearer session, and create a before/after history record with the Admin username and timestamp.

## Important publisher-access limitation

Anandabazar Patrika e-paper content is subscriber-controlled. This project does **not** scrape a subscriber page, bypass a paywall, or claim a public API exists. The automated job is an integration adapter. It becomes operational only after you have authorized access to a source/data adapter and configure its URL below. Without that external source configured, the status remains `NOT_CONFIGURED` and existing rates are retained.

## Environment configuration

Copy `backend/.env.example` to `backend/.env`, then set:

```properties
ABP_RATE_FEED_ENABLED=true
ABP_RATE_FEED_URL=https://YOUR-AUTHORIZED-ADAPTER-ENDPOINT/daily-rates
ABP_RATE_FEED_API_KEY=YOUR_ADAPTER_KEY
```

Do not place API keys in the React frontend. `ABP_RATE_FEED_URL` must be an endpoint you are permitted to access and reuse. The adapter must return the JSON contract below, mapping the authorized Kolkata newspaper data into the standard field names.

## Feed JSON contract

```json
{
  "publicationDate": "2026-11-04",
  "publishedAt": "2026-11-04T06:00:00",
  "unit": "PER_10_GRAMS",
  "gold24k": 146500.00,
  "gold22k": 134500.00,
  "silver999": 1450.00,
  "sourceReference": "Authorized Anandabazar Patrika Kolkata e-paper edition URL or issue reference"
}
```

`unit` can be `PER_10_GRAMS` or `PER_GRAM`. Use Kolkata local time for `publishedAt`; if the adapter provides an ISO timestamp with an offset, include the offset. The feed needs all three numeric prices and a reference to the exact edition. Invalid/partial results are rejected.

## Manual operation

1. Sign in as the owner (password plus authenticator OTP).
2. Open **Gold & Silver Rates**.
3. Enter 24K, 22K and 999 Silver amounts per 10 grams and save.
4. The system records previous and new amounts, the Admin username, local timestamp and action type.
5. The rate mode becomes `MANUAL`; automatic imports are ignored until **Switch to Auto Mode** is selected.

Public visitors can read the rate board but cannot edit rates or access the history API.
