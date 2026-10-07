// End-to-end tests: run the Actor against a mock Tomba API.
import assert from 'node:assert/strict';
import { after, afterEach, describe, it } from 'node:test';

import type { MockHandler, MockServer } from './helpers.js';
import { removeStorage, runActor, startMockTomba, startStandbyActor, totalCharges } from './helpers.js';

function verification(email: string, overrides: Record<string, unknown> = {}) {
    return {
        email: {
            email,
            result: 'deliverable',
            status: 'valid',
            score: 99,
            smtp_provider: 'Google Workspace',
            mx: { records: ['aspmx.l.google.com', 'alt1.aspmx.l.google.com'] },
            mx_check: true,
            smtp_server: true,
            smtp_check: true,
            accept_all: false,
            greylisted: false,
            block: false,
            gibberish: false,
            disposable: false,
            webmail: false,
            regex: true,
            whois: {
                registrar_name: 'namecheap, inc.',
                referral_url: 'https://www.namecheap.com/',
                created_date: '2020-07-07T20:54:07+02:00',
            },
            ...overrides,
        },
        sources: [
            {
                uri: 'https://tomba.io/about',
                website_url: 'tomba.io',
                extracted_on: '2021-02-08T20:09:54+01:00',
                last_seen_on: '2021-02-08T22:43:40+01:00',
                still_on_page: true,
            },
        ],
    };
}

/** Phone fixtures returned with `enrich_mobile=true`: two@ has two numbers, nophone@ none, everyone else one. */
function phonesFor(email: string): Record<string, unknown>[] {
    if (email.startsWith('nophone@')) return [];
    if (email.startsWith('two@')) {
        return [
            { number: '+14155550123', type: 'mobile' },
            { number: '+14155550199', type: 'work' },
        ];
    }
    return [{ number: '+14155550123', type: 'mobile' }];
}

/** Default Tomba behaviour for GET /email-verifier; `phone_data` only with `enrich_mobile=true`. */
const tomba: MockHandler = (req) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/email-verifier');
    const { email, enrich_mobile: enrichMobile } = req.query;
    const phones = enrichMobile === 'true' ? { phone_data: phonesFor(email) } : {};
    if (email === 'ghost@tomba.io')
        return {
            body: {
                data: verification(email, { result: 'undeliverable', status: 'invalid', score: 0, smtp_check: false }),
            },
        };
    if (email === 'null@tomba.io') return { body: { data: null } };
    if (email === 'empty@tomba.io') return { body: { data: {} } };
    if (email === 'errors@tomba.io') return { body: { data: null, errors: { message: 'Verification unavailable' } } };
    if (email === 'not-an-email') return { status: 422, body: { errors: { message: 'Invalid email address' } } };
    if (email === 'html@tomba.io') return { raw: '<html>Bad gateway</html>' };
    return { body: { data: { ...verification(email), ...phones } } };
};

const servers: MockServer[] = [];
const dirs: string[] = [];

async function mock(handler: MockHandler = tomba): Promise<MockServer> {
    const server = await startMockTomba(handler);
    servers.push(server);
    return server;
}

async function run(...args: Parameters<typeof runActor>) {
    const result = await runActor(...args);
    dirs.push(result.storageDir);
    return result;
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (s) => s.close()));
});

after(async () => {
    await Promise.all(dirs.map(removeStorage));
});

describe('email-verifier', () => {
    it('verifies an email and charges one event', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['b.mohamed@tomba.io'] }, endpoint: server.url });

        assert.equal(result.code, 0, result.output);
        assert.deepEqual(server.requests[0].query, { email: 'b.mohamed@tomba.io' });
        assert.deepEqual(result.items, [
            {
                ...verification('b.mohamed@tomba.io'),
                input: 'b.mohamed@tomba.io',
                phoneNumbers: 0,
                charged: true,
                chargedCredits: 1,
                cached: false,
            },
        ]);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('charges an undeliverable verdict, because it is a real answer', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['ghost@tomba.io'] }, endpoint: server.url });

        const email = result.items[0].email as Record<string, unknown>;
        assert.equal(email.result, 'undeliverable');
        assert.equal(email.status, 'invalid');
        assert.equal(result.items[0].charged, true);
        assert.equal(result.items[0].error, undefined);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('does not charge empty or null data, or a body with errors', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['null@tomba.io', 'empty@tomba.io', 'errors@tomba.io'] },
            endpoint: server.url,
        });

        assert.equal(result.code, 0, result.output);
        assert.equal(result.items.length, 3);
        assert.deepEqual(
            result.items.find((i) => i.input === 'null@tomba.io'),
            {
                input: 'null@tomba.io',
                phoneNumbers: 0,
                charged: false,
                chargedCredits: 0,
                cached: false,
                error: 'No verification data found',
            },
        );
        assert.deepEqual(
            result.items.find((i) => i.input === 'empty@tomba.io'),
            {
                input: 'empty@tomba.io',
                phoneNumbers: 0,
                charged: false,
                chargedCredits: 0,
                cached: false,
                error: 'No verification data found',
            },
        );
        assert.equal(result.items.find((i) => i.input === 'errors@tomba.io')?.error, 'Verification unavailable');
        assert.ok(result.items.every((i) => i.charged === false));
        assert.equal(totalCharges(result), 0);
    });

    it('sends the built-in credentials to Tomba', async () => {
        const server = await mock();
        await run({ input: { emails: ['b.mohamed@tomba.io'] }, endpoint: server.url });
        assert.equal(server.requests[0].headers['x-tomba-key'], 'ta_test_key');
        assert.equal(server.requests[0].headers['x-tomba-secret'], 'ts_test_secret');
    });

    it('normalizes and deduplicates emails', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['  B.Mohamed@Tomba.IO ', 'b.mohamed@tomba.io', 'B.MOHAMED@TOMBA.IO', '   ', 42] },
            endpoint: server.url,
        });
        assert.equal(result.code, 0, result.output);
        assert.deepEqual(
            server.requests.map((r) => r.query.email),
            ['b.mohamed@tomba.io'],
        );
        assert.equal(result.items.length, 1);
    });

    it('does not charge Tomba error statuses and does not retry them', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['not-an-email'] }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.equal(server.requests.length, 1);
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /422: Invalid email address/);
        assert.equal(totalCharges(result), 0);
    });

    it('does not charge a non-JSON body', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['html@tomba.io'] }, endpoint: server.url });
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /Invalid response/);
        assert.equal(totalCharges(result), 0);
    });

    it('retries 429 and 5xx responses, then charges the success once', async () => {
        let calls = 0;
        const server = await mock(async (req) => {
            calls++;
            if (calls === 1)
                return {
                    status: 429,
                    body: { errors: { message: 'Too many requests' } },
                    headers: { 'retry-after': '1' },
                };
            if (calls === 2) return { status: 503, body: {} };
            return tomba(req);
        });
        const result = await run({ input: { emails: ['b.mohamed@tomba.io'], maxRetries: 3 }, endpoint: server.url });
        assert.equal(server.requests.length, 3);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].charged, true);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('gives up after maxRetries without charging', async () => {
        const server = await mock(() => ({ status: 503, body: {} }));
        const result = await run({ input: { emails: ['b.mohamed@tomba.io'], maxRetries: 1 }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.equal(server.requests.length, 2);
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /503/);
        assert.equal(totalCharges(result), 0);
    });

    it('serves repeated runs from the cache for free', async () => {
        const server = await mock();
        const first = await run({ input: { emails: ['b.mohamed@tomba.io'] }, endpoint: server.url });
        const second = await run({
            input: { emails: ['b.mohamed@tomba.io'] },
            endpoint: server.url,
            storageDir: first.storageDir,
        });

        assert.equal(server.requests.length, 1);
        assert.equal(second.items.length, 1);
        assert.equal(second.items[0].cached, true);
        assert.equal(second.items[0].charged, false);
        assert.equal((second.items[0].email as Record<string, unknown>).status, 'valid');
        assert.equal(totalCharges(second), 0);
    });

    it('calls Tomba again when the cache is disabled', async () => {
        const server = await mock();
        const input = { emails: ['b.mohamed@tomba.io'], useCache: false };
        const first = await run({ input, endpoint: server.url });
        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir });
        assert.equal(server.requests.length, 2);
        assert.equal(second.items[0].cached, false);
        assert.deepEqual(second.chargeCounts, { 'tomba-request': 1 });
    });

    it('stops at the max charge limit and resumes without reprocessing', async () => {
        const server = await mock();
        const emails = ['a@acme.com', 'b@acme.com', 'c@acme.com', 'd@acme.com', 'e@acme.com'];
        const input = { emails, maxConcurrency: 1, useCache: false, maxResults: 100 };

        // Locally every event costs $1, so a $2 budget allows two billable requests.
        const first = await run({ input, endpoint: server.url, maxTotalChargeUsd: 2 });
        assert.equal(first.code, 0, first.output);
        assert.equal(totalCharges(first), 2);
        assert.equal(server.requests.length, 2);

        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir, keepStorage: true });
        assert.equal(second.code, 0, second.output);
        assert.deepEqual(
            server.requests.map((r) => r.query.email),
            emails,
        );
        assert.equal(second.items.length, 5);
    });

    it('respects maxResults', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['a@acme.com', 'b@acme.com', 'c@acme.com'], maxResults: 2, maxConcurrency: 1 },
            endpoint: server.url,
        });
        assert.equal(result.items.length, 2);
        assert.equal(server.requests.length, 2);
    });

    it('runs requests in parallel', async () => {
        let active = 0;
        let peak = 0;
        const server = await mock(async (req) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => {
                setTimeout(r, 100);
            });
            active--;
            return tomba(req);
        });
        const emails = Array.from({ length: 8 }, (_, i) => `person${i}@acme.com`);
        await run({ input: { emails, maxConcurrency: 4 }, endpoint: server.url });
        assert.equal(server.requests.length, 8);
        assert.ok(peak > 1 && peak <= 4, `peak concurrency ${peak}`);
    });

    it('fails without Tomba credentials and never calls the API', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['b.mohamed@tomba.io'] },
            endpoint: server.url,
            withCredentials: false,
        });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /misconfigured/);
        assert.doesNotMatch(result.output, /ta_test_key|ts_test_secret/);
        assert.equal(server.requests.length, 0);
    });

    it('sends enrich_mobile and webhook_url only when they are set', async () => {
        const server = await mock();
        await run({ input: { emails: ['b.mohamed@tomba.io'], enrichMobile: false }, endpoint: server.url });
        await run({
            input: {
                emails: ['john@tomba.io'],
                enrichMobile: true,
                webhookUrl: 'https://hooks.example.com/tomba',
            },
            endpoint: server.url,
        });
        assert.deepEqual(
            server.requests.map((r) => r.query),
            [
                { email: 'b.mohamed@tomba.io' },
                { email: 'john@tomba.io', enrich_mobile: 'true', webhook_url: 'https://hooks.example.com/tomba' },
            ],
        );
    });

    it('fails on a webhook URL that is not http(s) and never calls the API', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['b.mohamed@tomba.io'], webhookUrl: 'ftp://hooks.example.com' },
            endpoint: server.url,
        });
        assert.notEqual(result.code, 0);
        assert.equal(server.requests.length, 0);
    });

    it('charges 1 credit without enrichMobile and returns no phone data', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['two@tomba.io'] }, endpoint: server.url });
        assert.equal(result.items[0].phone_data, undefined);
        assert.equal(result.items[0].phoneNumbers, 0);
        assert.equal(result.items[0].chargedCredits, 1);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('charges 1 credit plus 5 per phone number with enrichMobile', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['one@tomba.io', 'two@tomba.io'], enrichMobile: true },
            endpoint: server.url,
        });
        assert.equal(result.code, 0, result.output);
        const one = result.items.find((i) => i.input === 'one@tomba.io');
        const two = result.items.find((i) => i.input === 'two@tomba.io');
        assert.deepEqual(one?.phone_data, [{ number: '+14155550123', type: 'mobile' }]);
        assert.equal(one?.phoneNumbers, 1);
        assert.equal(one?.chargedCredits, 6);
        assert.equal(one?.charged, true);
        assert.deepEqual(two?.phone_data, [
            { number: '+14155550123', type: 'mobile' },
            { number: '+14155550199', type: 'work' },
        ]);
        assert.equal(two?.phoneNumbers, 2);
        assert.equal(two?.chargedCredits, 11);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 17 });
    });

    it('charges 1 credit with enrichMobile when no phone number is found', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['nophone@tomba.io'], enrichMobile: true }, endpoint: server.url });
        assert.deepEqual(result.items[0].phone_data, []);
        assert.equal(result.items[0].phoneNumbers, 0);
        assert.equal(result.items[0].chargedCredits, 1);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('serves phone data from the cache for free', async () => {
        const server = await mock();
        const input = { emails: ['two@tomba.io'], enrichMobile: true };
        const first = await run({ input, endpoint: server.url });
        assert.equal(totalCharges(first), 11);
        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir });
        assert.equal(server.requests.length, 1);
        assert.equal(second.items[0].cached, true);
        assert.equal(second.items[0].charged, false);
        assert.equal(second.items[0].chargedCredits, 0);
        assert.equal(second.items[0].phoneNumbers, 2);
        assert.equal(totalCharges(second), 0);
    });

    it('does not reuse a cached result without phone data when enrichMobile is turned on', async () => {
        const server = await mock();
        const first = await run({ input: { emails: ['two@tomba.io'] }, endpoint: server.url });
        const second = await run({
            input: { emails: ['two@tomba.io'], enrichMobile: true },
            endpoint: server.url,
            storageDir: first.storageDir,
        });
        assert.equal(server.requests.length, 2);
        assert.equal(second.items[0].phoneNumbers, 2);
        assert.equal(totalCharges(second), 11);
    });

    it('fails on empty input', async () => {
        const server = await mock();
        const result = await run({ input: { emails: [] }, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.equal(server.requests.length, 0);
    });

    it('fails when emails is missing', async () => {
        const server = await mock();
        const result = await run({ input: {}, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.equal(server.requests.length, 0);
    });
});

describe('email-verifier standby (real-time API)', () => {
    it('answers the readiness probe and a bare GET with usage info', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const probe = await actor.call('/', { headers: { 'x-apify-container-server-readiness-probe': '1' } });
            assert.equal(probe.status, 200);
            const usage = await actor.call('/');
            assert.equal(usage.status, 200);
            assert.match(String(usage.body.usage), /GET/);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('verifies emails from GET query parameters and charges per credit', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            const res = await actor.call('/?email=Info@Tomba.io&email=null@tomba.io');
            assert.equal(res.status, 200);
            const items = res.body.items as Record<string, unknown>[];
            assert.deepEqual(
                items.find((i) => i.input === 'info@tomba.io'),
                {
                    ...verification('info@tomba.io'),
                    input: 'info@tomba.io',
                    phoneNumbers: 0,
                    charged: true,
                    chargedCredits: 1,
                    cached: false,
                },
            );
            assert.equal(items.find((i) => i.input === 'null@tomba.io')?.error, 'No verification data found');

            const phones = await actor.call('/?emails=two@tomba.io&enrichMobile=true');
            const [item] = phones.body.items as Record<string, unknown>[];
            assert.equal(item.phoneNumbers, 2);
            assert.equal(item.chargedCredits, 11);
            assert.equal(server.requests.at(-1)?.query.enrich_mobile, 'true');
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 12 });
    });

    it('accepts a POST with the same JSON input as a normal run', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const res = await actor.call('/', { body: { emails: ['a@acme.com', 'ghost@tomba.io'] } });
            assert.equal(res.status, 200);
            const items = res.body.items as Record<string, unknown>[];
            assert.equal(items.length, 2);
            assert.ok(items.every((i) => i.charged === true));
        } finally {
            await actor.stop();
        }
    });

    it('serves repeated requests from the cache for free', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            await actor.call('/?email=info@tomba.io');
            const second = await actor.call('/?email=info@tomba.io');
            assert.ok((second.body.items as Record<string, unknown>[]).every((i) => i.cached === true));
            assert.equal(server.requests.length, 1);
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 1 });
    });

    it('keeps serving after a request hits maxResults', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            // Standby uses the default concurrency (10): the requests already in flight still return.
            const emails = Array.from({ length: 12 }, (_, i) => `user${i}@acme.com`);
            const first = await actor.call('/', { body: { emails, maxResults: 1 } });
            assert.equal((first.body.items as unknown[]).length, 10);
            assert.equal(server.requests.length, 10);
            const second = await actor.call('/?email=d@acme.com,e@acme.com');
            assert.equal((second.body.items as unknown[]).length, 2);
        } finally {
            await actor.stop();
        }
    });

    it('rejects invalid input with 400 and unknown paths with 404', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            assert.equal((await actor.call('/', { body: {} })).status, 400);
            assert.equal((await actor.call('/', { body: { emails: 'a@acme.com' } })).status, 400);
            assert.equal((await actor.call('/', { body: 'not json' })).status, 400);
            assert.equal((await actor.call('/?maxResults=abc&email=a@acme.com')).status, 400);
            assert.equal((await actor.call('/?enrichMobile=maybe&email=a@acme.com')).status, 400);
            assert.equal((await actor.call('/?email=a@acme.com&webhookUrl=ftp://x')).status, 400);
            assert.equal((await actor.call('/nope')).status, 404);
            assert.equal((await actor.call('/', { method: 'DELETE' })).status, 405);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('returns 402 once the max charge limit is reached', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url, maxTotalChargeUsd: 1 });
        try {
            const first = await actor.call('/?email=a@acme.com');
            assert.equal(first.status, 200);
            const second = await actor.call('/?email=b@acme.com');
            assert.equal(second.status, 402);
            assert.equal(server.requests.length, 1);
        } finally {
            await actor.stop();
        }
    });
});
