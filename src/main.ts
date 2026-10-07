import { log } from 'apify';
import { Verifier } from 'tomba';

import { InputError, queryBool, queryInt, queryList, queryString, runActor } from './standby.js';
import type { RunOptions } from './tomba.js';
import { callTomba, getClient, normalizeEmail, PHONE_CREDITS, phoneDataCount, runPool, unique } from './tomba.js';

interface EmailVerifierInput extends RunOptions {
    emails?: string[];
    maxResults?: number;
    enrichMobile?: boolean;
    webhookUrl?: string;
}

/** Tomba: 1 verification credit, plus 5 per phone number returned with `enrich_mobile=true`. */
const credits = (body: Record<string, unknown>) => 1 + PHONE_CREDITS * phoneDataCount(body.data);

await runActor<EmailVerifierInput>({
    title: 'Email Verifier',
    count: (input) => input.emails?.length ?? 0,
    fromQuery: (query) => ({
        emails: queryList(query, 'email', 'emails'),
        enrichMobile: queryBool(query, 'enrichMobile'),
        webhookUrl: queryString(query, 'webhookUrl'),
        maxResults: queryInt(query, 'maxResults'),
    }),
    run: async (input, { push, isDone, markDone, standby }) => {
        if (!Array.isArray(input.emails) || !input.emails.length) {
            throw new InputError('Input must contain at least one email address in "emails".');
        }

        const maxResults = input.maxResults ?? 50;
        const enrichMobile = input.enrichMobile ?? false;
        const webhookUrl = typeof input.webhookUrl === 'string' ? input.webhookUrl.trim() : '';
        if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
            throw new InputError('"webhookUrl" must start with http:// or https://.');
        }

        const verifier = new Verifier(getClient());

        const emails = unique(input.emails.filter((email) => typeof email === 'string').map(normalizeEmail));
        const pending = emails.filter((email) => !isDone(email));
        if (pending.length < emails.length) {
            log.info(`Resuming: ${emails.length - pending.length} emails already processed.`);
        }
        if (!standby) {
            log.info(`Verifying ${pending.length} email addresses${enrichMobile ? ' (with phone numbers)' : ''}`);
        }

        let pushed = 0;
        const full = () => pushed >= maxResults;

        await runPool(
            pending,
            async (email) => {
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
                    res.data &&
                    typeof res.data === 'object' &&
                    !Array.isArray(res.data) &&
                    Object.keys(res.data).length > 0
                        ? (res.data as Record<string, unknown>)
                        : undefined;

                if (data) {
                    pushed++;
                    const phoneNumbers = phoneDataCount(data);
                    await push({
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
                    await push({
                        input: email,
                        phoneNumbers: 0,
                        charged: res.charged,
                        chargedCredits,
                        cached: res.cached,
                        error: res.error ?? 'No verification data found',
                    });
                    log.info(`${email}: ${res.error ?? 'no verification data found'}`);
                }

                markDone(email);
            },
            undefined,
            full,
        );
    },
});
