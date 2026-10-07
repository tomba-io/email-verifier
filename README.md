# Tomba Email Verifier

[![Price](https://img.shields.io/badge/Price-%243.12%20per%201K%20emails-brightgreen)](#pricing)
[![No signup](https://img.shields.io/badge/Tomba%20account-not%20needed-blue)](#quick-start)
[![No rate limit](https://img.shields.io/badge/Rate%20limit-none-brightgreen)](#built-for-big-lists)

**Clean your email list before you hit send.** Paste your addresses and find out in seconds which ones are deliverable, which will bounce and which are risky, with a confidence score and the checks behind every verdict. Need to call them too? Turn on **Find phone numbers** to get the phone numbers linked to each address. Protect your sender reputation and stop paying to email people who will never receive it.

No Tomba account. No API key. No subscription. **You pay $0.00312 per email, and only when we return a verdict.**

## Why teams choose this Actor

- **Start in 30 seconds**: Open the Actor, paste your emails, click Start. Nothing to sign up for
- **Pay only for results**: Errors and invalid inputs are free
- **$3.12 per 1,000 emails**: No monthly plan, no credits that expire, no minimum spend
- **Real-time checks**: Format, domain, mail server and mailbox are checked live for every address
- **Spot risky addresses**: Flags disposable, webmail, catch-all, greylisted and gibberish addresses
- **Built for big lists**: No rate limit. Thousands of emails run in parallel
- **Never pay twice**: Emails you verified in the last 24 hours come back from cache for free
- **Export anywhere**: Download as CSV, Excel or JSON, or send results straight to your CRM or email tool with Apify integrations

## Promises we actually keep

- **Less than 5% bounce rate** — Every email is verified in real time before you're charged.

## What you can do with it

| Goal                            | How verification helps                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| **Protect your domain**         | Keep bounces low so your emails keep landing in the inbox            |
| **Clean old lists**             | Remove addresses that died since your last campaign                  |
| **Check leads before outreach** | Verify every new prospect before it enters a sequence                |
| **Stop fake sign-ups**          | Catch disposable and gibberish addresses in your forms               |
| **Save on your email tool**     | Stop paying your email platform for contacts that can't receive mail |

## Quick start

1. Click **Try for free**
2. Paste your addresses into **Email Addresses** (for example `john@stripe.com`)
3. Click **Start**, then download your results as CSV, Excel or JSON

That's it. No Tomba account or API key is needed.

## Input

| Field            | Required | Default | Description                                                                                                    |
| ---------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `emails`         | Yes      |         | Email addresses to verify (up to 1,000 per run)                                                                |
| `maxResults`     | No       | `50`    | Maximum number of emails to verify                                                                             |
| `enrichMobile`   | No       | `false` | Also return the phone numbers linked to each email. Each phone number adds 5 credits (see [Pricing](#pricing)) |
| `webhookUrl`     | No       |         | URL (`http://` or `https://`) that Tomba notifies when a result is ready                                       |
| `maxConcurrency` | No       | `10`    | How many emails to verify at the same time (1–50)                                                              |
| `maxRetries`     | No       | `3`     | How many times to retry a temporary failure (0–10)                                                             |
| `useCache`       | No       | `true`  | Reuse results from your previous runs for free                                                                 |
| `cacheTtlHours`  | No       | `24`    | How long cached results stay valid (`0` turns the cache off)                                                   |

```json
{
    "emails": ["john@stripe.com", "jane@shopify.com", "support@tomba.io"],
    "maxResults": 1000,
    "enrichMobile": false
}
```

## Output

You get one row per email:

```json
{
    "email": {
        "email": "b.mohamed@tomba.io",
        "result": "deliverable",
        "status": "valid",
        "score": 99,
        "smtp_provider": "Google Workspace",
        "mx": { "records": ["aspmx.l.google.com", "alt1.aspmx.l.google.com"] },
        "mx_check": true,
        "smtp_server": true,
        "smtp_check": true,
        "accept_all": false,
        "greylisted": false,
        "block": false,
        "gibberish": false,
        "disposable": false,
        "webmail": false,
        "regex": true,
        "whois": {
            "registrar_name": "namecheap, inc.",
            "referral_url": "https://www.namecheap.com/",
            "created_date": "2020-07-07T20:54:07+02:00"
        }
    },
    "sources": [
        {
            "uri": "https://github.com/tomba-io/generic-emails",
            "website_url": "github.com",
            "extracted_on": "2021-02-08T20:09:54+01:00",
            "last_seen_on": "2021-02-08T22:43:40+01:00",
            "still_on_page": true
        }
    ],
    "phone_data": [{ "number": "+14155550123", "type": "mobile" }],
    "input": "b.mohamed@tomba.io",
    "phoneNumbers": 1,
    "charged": true,
    "chargedCredits": 6,
    "cached": false
}
```

| Field                 | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `email.email`         | The verified address                                              |
| `email.result`        | The verdict: `deliverable`, `undeliverable`, `risky` or `unknown` |
| `email.status`        | The status, e.g. `valid` or `invalid`                             |
| `email.score`         | Confidence score from 0 to 100 (higher is better)                 |
| `email.smtp_provider` | The email provider, e.g. Google Workspace                         |
| `email.regex`         | `true` if the address is correctly formatted                      |
| `email.gibberish`     | `true` if the address looks random                                |
| `email.disposable`    | `true` if it is a temporary, throwaway address                    |
| `email.webmail`       | `true` if it is a free webmail address such as Gmail              |
| `email.mx_check`      | `true` if the domain has mail servers                             |
| `email.mx`            | The domain's mail servers                                         |
| `email.smtp_server`   | `true` if the mail server answered                                |
| `email.smtp_check`    | `true` if the mailbox exists                                      |
| `email.accept_all`    | `true` if the domain accepts every address (catch-all)            |
| `email.greylisted`    | `true` if the mail server asked us to try again later             |
| `email.block`         | `true` if the mail server blocked the check                       |
| `email.whois`         | Domain registrar and creation date                                |
| `sources`             | Public web pages where the address was found                      |
| `phone_data`          | Phone numbers linked to the address (only with `enrichMobile`)    |
| `phoneNumbers`        | How many phone numbers were returned                              |
| `input`               | The address you submitted (lowercased)                            |
| `charged`             | `true` if this verification was billed                            |
| `chargedCredits`      | Credits billed for this row (1, plus 5 per phone number)          |
| `cached`              | `true` if this result came from the cache (free)                  |
| `error`               | Why no verdict was returned, if applicable                        |

The dataset has three ready-made views: **Overview**, **Detailed View** and **Source Analysis**.

## Pricing

**$0.00312 per credit.** Verifying an email costs 1 credit ($3.12 per 1,000 emails). No subscription and no Tomba account needed.

| Result                                          | Credits | Price    |
| ----------------------------------------------- | ------- | -------- |
| Email verification                              | 1       | $0.00312 |
| `enrichMobile` on, no phone number found        | 1       | $0.00312 |
| `enrichMobile` on, 1 phone number returned      | 6       | $0.01872 |
| `enrichMobile` on, 2 phone numbers returned     | 11      | $0.03432 |
| `enrichMobile` on, each additional phone number | +5      | +$0.0156 |

Phone data adds $0.0156 (5 credits) per phone number returned, and only when `enrichMobile` is on.

You are only charged when Tomba returns a verdict:

| What happens                                    | Charged |
| ----------------------------------------------- | ------- |
| The email is verified (deliverable)             | Yes     |
| The email is verified (undeliverable or risky)  | Yes     |
| No verdict returned                             | No      |
| Malformed address or any other error            | No      |
| Temporary failure (it is retried automatically) | No      |
| Result served from the cache                    | No      |

Every row shows `charged`, `chargedCredits` and `cached`, so you always know what you paid for. To cap your spend, set **Maximum cost per run** in the run options: the Actor stops cleanly when the limit is reached.

## Built for big lists

- **No rate limit**: up to 50 emails are verified at the same time
- **Automatic retries**: temporary failures are retried for you, and never billed
- **Resumable**: if a run is interrupted, it continues where it stopped without charging you again
- **Cache**: repeat verifications within 24 hours are free
- **No duplicates**: addresses are trimmed and lowercased, and duplicates are verified once

## Real-time API

Need results instantly inside your own app? This Actor also runs as a **real-time API** (Apify Standby mode): no run to start, no dataset to fetch, just an HTTP request that returns JSON in seconds. Pricing is the same.

Verify one or more emails with a `GET` request (repeat `email` or separate emails with commas):

```bash
curl "https://<your-standby-url>/?email=info@tomba.io&email=jane@shopify.com" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>"
```

You can also `POST` the same JSON input as a normal run:

```bash
curl -X POST "https://<your-standby-url>/" \
  -H "Authorization: Bearer <YOUR_APIFY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"emails": ["info@tomba.io", "jane@shopify.com"], "enrichMobile": true}'
```

The response is `{ "items": [...] }`, with the same rows as the dataset. Find your Standby URL and the full OpenAPI description in the **API** tab of this Actor.

## Integrations

Run it on a schedule, call it from the Apify API, or connect it to Zapier, Make, Google Sheets, HubSpot, Slack and hundreds of other apps with [Apify integrations](https://docs.apify.com/platform/integrations). Webhooks let you trigger your own workflow as soon as a run finishes.

## FAQ

**Do I need a Tomba account or API key?**
No. Everything is built in. You only pay the per-email price on Apify.

**How much does it cost?**
$0.00312 per verified email ($3.12 per 1,000). An undeliverable verdict is still a verdict, so it is charged. With `enrichMobile` on, each phone number returned adds $0.0156. Errors and cached lookups are free.

**Can I get phone numbers too?**
Yes. Turn on **Find phone numbers** (`enrichMobile`). Numbers come back in `phone_data`, and `phoneNumbers` tells you how many. Each phone number returned adds 5 credits ($0.0156) to the 1-credit verification, so an email with 2 numbers costs 11 credits ($0.03432). If no phone number is found you pay the normal 1 credit. Phone lookups are off by default.

**How many emails can I verify in one run?**
Up to 1,000 per run, processed in parallel. There is no rate limit.

**What does each verdict mean?**
`deliverable` means the mailbox exists and accepts mail. `undeliverable` means it will bounce. `risky` means the address may work but carries a risk, for example a catch-all domain or a disposable address. `unknown` means the mail server didn't give a clear answer.

**Should I email "risky" addresses?**
Use the score and the flags to decide. Catch-all addresses at real companies are often fine. Disposable and gibberish addresses are best removed.

**Do you send an email to the address?**
No. We check the address with the mail server without sending anything, so the person is never contacted.

**What if my run is interrupted?**
It picks up where it stopped. Emails already verified are not charged again.

**How do I limit what I spend?**
Set **Maximum cost per run** before you start. The Actor stops as soon as the limit is reached.

## Support

Questions or feedback? We're happy to help:

- **Email**: support@tomba.io
- **Live chat**: on [tomba.io](https://tomba.io) during business hours
- **Issues**: use the **Issues** tab on this Actor's page

## About Tomba

Founded in 2020, [Tomba](https://tomba.io) is a B2B data platform for finding, verifying and enriching business contacts. Our Email Finder, Domain Search and Email Verifier help sales and marketing teams reach the right people.

![Tomba Logo](https://tomba.io/logo.png)
