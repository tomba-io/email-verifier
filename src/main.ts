import { Actor, log } from 'apify';
import { Verifier } from 'tomba';

import type { RunOptions } from './tomba.js';
import {
    callTomba,
    logSummary,
    normalizeEmail,
    PHONE_CREDITS,
    phoneDataCount,
    runPool,
    setupTomba,
    stop,
    unique,
    useRunState,
} from './tomba.js';

interface EmailVerifierInput extends RunOptions {
    emails: string[];
    maxResults?: number;
    enrichMobile?: boolean;
    webhookUrl?: string;
}

await Actor.init();

const input = await Actor.getInput<EmailVerifierInput>();
if (!input?.emails?.length) {
    await Actor.fail('Input must contain at least one email address in "emails".');
}

const { emails: rawEmails, maxResults = 50, enrichMobile = false, webhookUrl: rawWebhookUrl, ...runOptions } = input!;
const webhookUrl = typeof rawWebhookUrl === 'string' ? rawWebhookUrl.trim() : '';
if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
    await Actor.fail('"webhookUrl" must start with http:// or https://.');
}

const client = await setupTomba(runOptions);
const verifier = new Verifier(client);
const state = await useRunState();

const emails = unique(rawEmails.filter((email) => typeof email === 'string').map(normalizeEmail));
const pending = emails.filter((email) => !state.done[email]);
if (pending.length < emails.length) {
    log.info(`Resuming: ${emails.length - pending.length} emails already processed.`);
}

let pushed = 0;
const startedAt = Date.now();
log.info(`Verifying ${pending.length} email addresses${enrichMobile ? ' (with phone numbers)' : ''}`);

/** Tomba: 1 verification credit, plus 5 per phone number returned with `enrich_mobile=true`. */
const credits = (body: Record<string, unknown>) => 1 + PHONE_CREDITS * phoneDataCount(body.data);

await runPool(pending, async (email) => {
    if (pushed >= maxResults) {
        stop();
        return;
    }

    // Optional parameters are only sent (and only part of the cache key) when set.
    const params: Record<string, unknown> = { email };
    if (enrichMobile) params.enrich_mobile = true;
    if (webhookUrl) params.webhook_url = webhookUrl;

    const res = await callTomba(
        'email-verifier',
        params,
        async () => verifier.emailVerifier(email, enrichMobile || undefined, webhookUrl || undefined),
        undefined,
        credits,
    );
    if (res.skipped) return;

    const chargedCredits = res.chargedCount ?? 0;

    const data =
        res.data && typeof res.data === 'object' && !Array.isArray(res.data) && Object.keys(res.data).length > 0
            ? (res.data as Record<string, unknown>)
            : undefined;

    if (data) {
        pushed++;
        const phoneNumbers = phoneDataCount(data);
        await Actor.pushData({
            ...data,
            input: email,
            phoneNumbers,
            charged: res.charged,
            chargedCredits,
            cached: res.cached,
        });
        const status = (data.email as Record<string, unknown> | undefined)?.status;
        const phones = phoneNumbers ? `, ${phoneNumbers} phone numbers` : '';
        log.info(
            `${email}: ${typeof status === 'string' ? status : 'unknown'}${phones}${res.cached ? ' (cached)' : ''}`,
        );
    } else {
        await Actor.pushData({
            input: email,
            phoneNumbers: 0,
            charged: res.charged,
            chargedCredits,
            cached: res.cached,
            error: res.error ?? 'No verification data found',
        });
        log.info(`${email}: ${res.error ?? 'no verification data found'}`);
    }

    state.done[email] = true;
});

logSummary('Email Verifier', emails.length, startedAt);

await Actor.exit();
