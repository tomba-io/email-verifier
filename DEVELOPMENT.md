# Development

Notes for maintainers of the Tomba Email Verifier Actor. The README is the end-user page shown on Apify Store.

## Requirements

- Node.js 20+
- [Apify CLI](https://docs.apify.com/cli) for deployment

## Scripts

```bash
npm install
npm run build     # compile TypeScript to dist/
npm run lint      # ESLint (src and test)
npm run format    # Prettier
npm test          # unit + end-to-end tests (node:test)
npm start         # run locally with tsx
```

## Credentials

The Actor uses our Tomba account. Users never enter an API key: credentials come from environment variables, never from the input:

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `TOMBA_API_KEY`      | Tomba API key (`ta_…`)                             |
| `TOMBA_API_SECRET`   | Tomba secret (`ts_…`)                              |
| `TOMBA_API_ENDPOINT` | Optional API base URL; only used by the test suite |

`.actor/actor.json` maps the variables to Apify secrets:

```bash
apify secrets add tombaApiKey ta_xxxxxxxxxxxxxxxxxxxx
apify secrets add tombaApiSecret ts_xxxxxxxxxxxxxxxxxxxx
apify push
```

Run locally:

```bash
TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
```

There is no client-side rate limit: requests run in parallel (`maxConcurrency`, 1–50) and 429/5xx responses are retried with exponential backoff, honoring `Retry-After`.

## Deploy

- **From Git**: on the [Actor creation page](https://console.apify.com/actors/new), click **Link Git Repository**
- **From your machine**: `apify login`, then `apify push`

## Pricing (pay per event)

In **Apify Console → Publication → Monetization**, choose **Pay per event** and add:

| Event           | Price    | Charged when                                  |
| --------------- | -------- | --------------------------------------------- |
| `tomba-request` | $0.00312 | Tomba returns a billable response (see below) |

Every Tomba credit is one `tomba-request` event. The count follows Tomba's published rule for Email Verifier, **1 verification credit, plus 5 per phone number returned with `enrich_mobile=true`**:

| Billable response                                       | Events (`count`)                  |
| ------------------------------------------------------- | --------------------------------- |
| Without `enrichMobile`                                  | 1                                 |
| `enrichMobile=true`, `data.phone_data` has _n_ numbers  | 1 + 5 × _n_ (`PHONE_CREDITS` = 5) |
| `enrichMobile=true`, `data.phone_data` missing or empty | 1                                 |

`main.ts` passes `count = (body) => 1 + PHONE_CREDITS * phoneDataCount(body.data)` to `callTomba()`. Each item reports the events actually charged in `chargedCredits` (`res.chargedCount ?? 0`, so 0 for cache hits and errors) and the number of phones in `phoneNumbers`.

`isBillable()` in `src/tomba.ts` mirrors Tomba's billing:

| Tomba outcome                                          | Charged |
| ------------------------------------------------------ | ------- |
| JSON with non-empty `data`, including negative answers | Yes     |
| Error status (4xx, 5xx, including 422 and 429)         | No      |
| Success with empty or null `data`                      | No      |
| Success with an `errors` object                        | No      |
| Non-JSON body (reported as 502)                        | No      |
| Cache hit                                              | No      |

Every verdict (deliverable, undeliverable, risky, unknown) is a non-empty answer and is charged.

## Architecture

- `src/tomba.ts`: shared helper, identical in every Tomba Actor. It handles credentials, caching (`tomba-cache` key-value store), retries with exponential backoff, pay-per-event charging, budget reservation, the concurrency pool and resume state.
- `src/main.ts`: input normalization (non-strings dropped, emails trimmed, lowercased and deduplicated) and output mapping. The Tomba `data` object (`email`, `sources`, and `phone_data` when returned) is spread into the row, followed by `input`, `phoneNumbers`, `charged`, `chargedCredits` and `cached`.
- The SDK call is `Verifier.emailVerifier(email, enrich_mobile, webhook_url)` → `GET /email-verifier?email=…&enrich_mobile=true&webhook_url=…`. `enrich_mobile` is only sent when `enrichMobile` is on and `webhook_url` only when `webhookUrl` is set; both are part of the cache key, so results with and without phone data are cached separately.
- The `tomba` SDK v1.1.1 resolves every call to `{ data, rateLimit }`, where `data` is the response body. Its `.d.ts` types still declare the old return type, so always go through `callTomba()`.

## Tests

- `test/tomba.test.ts`: unit tests for the shared helper (identical in every Actor)
- `test/main.test.ts`: end-to-end tests that run `src/main.ts` against a local mock Tomba API
- `test/helpers.ts`: mock server and Actor runner (identical in every Actor)

Locally, the Apify SDK prices every event at $1 when `ACTOR_TEST_PAY_PER_EVENT=true`, so the tests use `maxTotalChargeUsd` as an event count.
