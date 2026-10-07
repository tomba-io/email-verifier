# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.0.0 (2026-10-07)

### ⚠ BREAKING CHANGES

- `tombaApiKey` and `tombaApiSecret` inputs were removed. The Actor now uses built-in Tomba credentials from the `TOMBA_API_KEY` / `TOMBA_API_SECRET` environment variables, so users no longer need a Tomba account.

### Features

- Pay-per-event pricing: $0.00312 per billable request (`tomba-request`); errors, empty results and cache hits are free
- No client-side rate limit; parallel processing with `maxConcurrency`
- Automatic retries with exponential backoff for network errors, 429 and 5xx (`maxRetries`)
- Cross-run result cache (`useCache`, `cacheTtlHours`)
- Resume after migration or restart
- Emails are trimmed, lowercased and deduplicated
- Each dataset item now includes `charged` and `cached`
- `enrichMobile` input: return the phone numbers linked to the email in `phone_data` (1 credit plus 5 per phone number returned)
- `webhookUrl` input, sent to Tomba as `webhook_url`
- Each dataset item now includes `phoneNumbers` and `chargedCredits`

### Dependencies

- `tomba` upgraded to 1.1.1 (responses are now `{ data, rateLimit }`)
- `apify` upgraded to 3.7.2

### [0.0.3](https://github.com/tomba-io/email-verifier/compare/v0.0.2...v0.0.3) (2025-10-31)

### Features

- **actor:** add input, output schemas and dataset storage configuration ([82f2c32](https://github.com/tomba-io/email-verifier/commit/82f2c32364e4d6c79bbc736b0129fe3f9fd79d43))
- **schema:** add output schema ([88f0cbe](https://github.com/tomba-io/email-verifier/commit/88f0cbed8139ac5c7971e5eca46a7c916fc96513))

### Bug Fixes

- **docs:** update Email Verifier Endpoint link to the correct documentation ([cd6dfaa](https://github.com/tomba-io/email-verifier/commit/cd6dfaa42535a7833a010af0a82bc2d1ae40e7e2))
- **schema:** add prefill ([9763a6e](https://github.com/tomba-io/email-verifier/commit/9763a6e3e61d22612cf4bacd6c9f10cdeded5183))
- **schema:** allow null values for MX records and WHOIS properties ([c0fb905](https://github.com/tomba-io/email-verifier/commit/c0fb9052fc9ce90e61df9455771272f5fb20273a))

### 0.0.2 (2025-10-24)
