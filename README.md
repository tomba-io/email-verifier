# Tomba Email Verifier Actor

[![Actor](https://img.shields.io/badge/Apify-Actor-blue)](https://apify.com/actors)
[![Tomba API](https://img.shields.io/badge/Tomba-API-green)](https://tomba.io)
[![Rate Limit](https://img.shields.io/badge/Rate%20Limit-150%2Fmin-orange)](https://tomba.io/api)

A powerful Apify Actor that **verifies the validity of any professional email address with the most complete email checker** using the **Tomba Email Verifier API**. Perfect for email marketing, lead generation, and data quality assurance by ensuring your email lists contain only valid, deliverable addresses.

## Key Features

- **Complete Email Verification**: Comprehensive validity checks for professional email addresses
- **Deliverability Testing**: Real-time SMTP validation and mailbox verification
- **Risk Assessment**: Identify disposable, webmail, and risky email addresses
- **Bulk Processing**: Verify hundreds of emails efficiently with rate limiting
- **Rate Limited**: Respects Tomba's 150 requests per minute limit
- **Rich Verification Data**: Detailed verification scores and technical checks
- **Built-in Error Handling**: Robust processing with comprehensive error reporting

## How it works

The Actor leverages Tomba's powerful Email Verifier API to perform comprehensive email validation:

### Process Flow

1. **Authentication**: Connects to Tomba API using your credentials
2. **Input Processing**: Accepts array of email addresses to verify
3. **Email Verification**: Uses Tomba's `emailVerifier` method for each email
4. **Validation Checks**: Performs regex, SMTP, MX record, and deliverability tests
5. **Rate Limiting**: Automatically handles 150 requests/minute limit
6. **Data Storage**: Saves detailed verification results to Apify dataset

### What You Get

For each verified email, you'll receive:

- **Verification Result**: Valid, invalid, risky, or unknown status
- **Confidence Score**: 0-100 score indicating verification confidence
- **Technical Checks**: Regex validation, MX records, SMTP server status
- **Risk Factors**: Disposable email detection, webmail identification
- **Deliverability**: Accept-all domain detection, block status
- **Quality Metrics**: Gibberish detection and comprehensive analysis

## Quick Start

### Prerequisites

1. **Tomba Account**: Sign up at [Tomba.io](https://app.tomba.io/api) to get your API credentials

### Getting Your API Keys

1. Visit [Tomba API Dashboard](https://app.tomba.io/api)
2. Copy your **API Key** (starts with `ta_`)
3. Copy your **Secret Key** (starts with `ts_`)

## Input Configuration

### Required Parameters

| Parameter        | Type     | Description                        |
| ---------------- | -------- | ---------------------------------- |
| `tombaApiKey`    | `string` | Your Tomba API key (ta_xxxx)       |
| `tombaApiSecret` | `string` | Your Tomba secret key (ts_xxxx)    |
| `emails`         | `array`  | Array of email addresses to verify |

### Optional Parameters

| Parameter    | Type     | Default | Description                         |
| ------------ | -------- | ------- | ----------------------------------- |
| `maxResults` | `number` | `50`    | Maximum number of results to return |

### Example Input

```json
{
    "tombaApiKey": "ta_xxxxxxxxxxxxxxxxxxxx",
    "tombaApiSecret": "ts_xxxxxxxxxxxxxxxxxxxx",
    "emails": ["john.doe@company.com", "sales@example.org", "support@startup.io", "invalid@fakeemail.xyz"],
    "maxResults": 100
}
```

### Best Practices

- **Email Quality**: Use properly formatted email addresses for best results
- **Rate Limits**: The Actor automatically handles Tomba's 150 requests/minute limit
- **Batch Size**: Process 50-100 emails at a time for optimal performance
- **Data Cleaning**: Pre-filter obvious invalid formats to save API credits

## Output Data Structure

The Actor returns comprehensive verification information for each email:

```json
{
    "email": {
        "email": "b.mohamed@tomba.io",
        "result": "deliverable",
        "status": "valid",
        "score": 99,
        "smtp_provider": "Google Workspace",
        "mx": {
            "records": [
                "aspmx.l.google.com",
                "alt2.aspmx.l.google.com",
                "alt1.aspmx.l.google.com",
                "alt4.aspmx.l.google.com",
                "alt3.aspmx.l.google.com"
            ]
        },
        "mx_check": true,
        "smtp_server": true,
        "smtp_check": true,
        "accept_all": false,
        "greylisted": false,
        "block": true,
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
            "uri": "https://github.com/tomba-io/generic-emails/blob/084fc1a63d3cdaf9a34f255bedc2baea49a8e8b9/src/lib/validation/hash.ts",
            "website_url": "github.com",
            "extracted_on": "2021-02-08T20:09:54+01:00",
            "last_seen_on": "2021-02-08T22:43:40+01:00",
            "still_on_page": true
        }
    ],
    "input": "b.mohamed@tomba.io"
}
```

### Data Fields Explained

#### Email Verification Object

- **email**: The verified email address
- **result**: Deliverability status (deliverable, undeliverable, risky, unknown)
- **status**: Validation status (valid, invalid, risky, unknown)
- **score**: Confidence level from 0-100 (higher is better)
- **smtp_provider**: Email provider name (e.g., "Google Workspace", "Microsoft Exchange")

#### Technical Validation

- **regex**: Whether email passes basic format validation
- **gibberish**: Whether email appears to be random/meaningless
- **disposable**: Whether email is from a temporary email service
- **webmail**: Whether email is from Gmail, Yahoo, etc.
- **mx_check**: Whether MX records check passed
- **smtp_server**: Whether SMTP server is reachable
- **smtp_check**: Whether SMTP validation was successful
- **accept_all**: Whether domain accepts all email addresses
- **greylisted**: Whether the email is greylisted
- **block**: Whether email is on a blocklist

#### Additional Data

- **mx**: Object containing MX record servers array
- **whois**: Domain registration information (registrar, creation date, etc.)
- **sources**: Array of sources where the email was found online
- **input**: Original input email address for reference

## Use Cases

### Email Marketing

- **List Cleaning**: Remove invalid emails before campaigns
- **Bounce Reduction**: Prevent hard bounces and protect sender reputation
- **Quality Assurance**: Ensure high deliverability rates

### Lead Generation

- **Lead Qualification**: Verify contact information quality
- **Data Validation**: Clean imported lead lists
- **CRM Integration**: Maintain clean contact databases

### Data Quality

- **Database Maintenance**: Regular cleanup of email databases
- **Import Validation**: Verify emails during data import
- **Compliance**: Ensure GDPR/CAN-SPAM compliance with valid contacts

### Risk Management

- **Fraud Prevention**: Identify disposable and risky email addresses
- **User Registration**: Validate emails during account creation
- **Security**: Block known problematic email domains

## Verification Views

The Actor provides specialized data views:

### Overview View

Quick summary showing email, result, score, and key flags

### Valid Emails View

Filtered view showing only successfully verified emails

### Invalid Emails View

Focus on failed verifications with error details

### Verification Errors View

Troubleshoot processing issues and API errors

## Resources & Documentation

### API Documentation

- [Tomba API Docs](https://tomba.io/api) - Complete API reference
- [Email Verifier Endpoint](https://docs.tomba.io/api/verifier#email-verifier) - Specific verification documentation
- [Authentication Guide](https://app.tomba.io/api) - Get your API keys
- [Pricing & Limits](https://tomba.io/pricing) - Understand rate limits and costs

### Rate Limiting

- Tomba limits to **150 requests per minute**
- Actor automatically handles rate limiting with delays
- Large email lists may take time to complete

### Cost Considerations

- Each email verification = 1 Tomba API request
- Monitor your Tomba usage dashboard
- Consider Tomba's pricing tiers for volume usage

### Best Practices

- **Pre-filtering**: Remove obvious invalid formats before verification
- **Batch Processing**: Group verifications for efficiency
- **Result Interpretation**: Use score and multiple flags for decision making
- **Regular Cleaning**: Periodically re-verify older email lists

## Keywords

email verification, email validation, email checker, deliverability, bounce detection, email quality, contact validation, email hygiene, email list cleaning, invalid emails, verification service, email testing

## Support

If you need any help, have questions, or encounter any issues while using Tomba.io, please don't hesitate to reach out to our support team. You can contact us via:

- **Email**: support@tomba.io
- **Live chat**: Available on the Tomba.io website during business hours

## Contributing

We welcome contributions to improve this actor. Please feel free to submit issues, feature requests, or pull requests to help make this tool even better for the community.

## About Tomba

Founded in 2020, Tomba prides itself on being the most reliable, accurate, and in-depth source of email address data available anywhere. We process terabytes of data to produce our Email finder API.

![Tomba Logo](https://tomba.io/logo.png)
