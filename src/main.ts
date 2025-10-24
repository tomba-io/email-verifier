import { Actor } from 'apify';
import { TombaClient, Verifier } from 'tomba';

interface ActorInput {
    tombaApiKey: string;
    tombaApiSecret: string;
    emails: string[];
    maxResults?: number;
}

// Rate limiting: 150 requests per minute for Tomba API
const RATE_LIMIT_REQUESTS = 150;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

let requestCount = 0;
let windowStart = Date.now();

async function rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - windowStart >= RATE_LIMIT_WINDOW) {
        requestCount = 0;
        windowStart = now;
    }

    // Wait if we've hit the rate limit
    if (requestCount >= RATE_LIMIT_REQUESTS) {
        const waitTime = RATE_LIMIT_WINDOW - (now - windowStart);
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), waitTime);
        });

        // Reset after waiting
        requestCount = 0;
        windowStart = Date.now();
    }

    requestCount++;
    return await requestFn();
}

// The init() call configures the Actor for its environment
await Actor.init();

try {
    // Get input from the Actor
    const input = (await Actor.getInput()) as ActorInput;

    if (!input?.tombaApiKey || !input?.tombaApiSecret) {
        throw new Error('Missing required parameters: tombaApiKey and tombaApiSecret are required');
    }

    if (!input?.emails || !Array.isArray(input.emails) || input.emails.length === 0) {
        throw new Error('Missing required parameter: emails array is required and must not be empty');
    }

    console.log(`Starting Tomba email verification for ${input.emails.length} emails`);

    // Initialize Tomba client
    const client = new TombaClient();
    const verifier = new Verifier(client);
    client.setKey(input.tombaApiKey).setSecret(input.tombaApiSecret);

    const results: Record<string, unknown>[] = [];
    const maxResults = input.maxResults || 50;
    let processedCount = 0;

    // Process each email
    for (const email of input.emails) {
        if (processedCount >= maxResults) {
            console.log(`Reached maximum results limit: ${maxResults}`);
            break;
        }

        if (!email || typeof email !== 'string') {
            console.log(`Skipping invalid email: ${email}`);
            results.push({
                email: email || 'invalid',
                error: 'Invalid email format',
                source: 'tomba_email_verifier',
            });
            continue;
        }

        try {
            console.log(`Verifying email: ${email}`);

            // Use Tomba's email verifier method with rate limiting
            const result = verifier.emailVerifier(email);

            const tombaResult = await rateLimitedRequest(async () => await result);

            if (tombaResult && tombaResult.data) {
                const verificationData = {
                    ...tombaResult.data,
                    input: email,
                };

                results.push(verificationData);
                console.log(`Verified email: ${email} - Result: ${tombaResult.data.email?.status || 'Unknown'}`);
            } else {
                // Add empty result if no data found
                results.push({
                    input: email,
                    error: 'No verification data found',
                });
            }

            processedCount++;
        } catch (error) {
            console.log(`Error verifying email ${email}:`, error);

            // Add error entry to results for transparency
            results.push({
                input: email,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    if (results.length > 0) {
        await Actor.pushData(results);
    }

    // Log summary
    console.log('=== SUMMARY ===');
    console.log(`Total emails processed: ${input.emails.length}`);
    console.log(`Successful verifications: ${results.filter((r) => !('error' in r)).length}`);
    console.log(`Failed verifications: ${results.filter((r) => 'error' in r).length}`);
} catch (error) {
    console.error('Actor failed:', error);
    throw error;
}

// Gracefully exit the Actor process
await Actor.exit();
