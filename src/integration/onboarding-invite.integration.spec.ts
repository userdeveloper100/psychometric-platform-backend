/**
 * DEC-02 regression suite: invitation-only onboarding, end to end against the test database.
 *   - Public registration is closed (403) and creates nothing.
 *   - An ADMIN issues a hashed, institute-scoped invite. The raw token is shown once and never stored or listed.
 *   - A public, token-bound accept creates the user in the invited institute and role, and the invite is single use.
 *   - Unusable invites (unknown, expired, revoked, used, inactive institute, existing email) are one generic 400.
 *   - Admins list and revoke only their own institute's invites. A foreign invite is 404.
 */

import { createHash } from 'crypto';
import logger from '../config/logger';
import {
    api,
    bodyText,
    DENIED_STATUSES,
    prisma,
    seedTwoTenants,
    TwoTenantFixture,
} from '../test-utils/integration/harness';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const INVITE_REFUSAL = 'Invite is invalid or no longer usable';
const DAY_MS = 24 * 60 * 60 * 1000;

let fx: TwoTenantFixture;

/** Issues an invite through the API as the given admin and returns the raw token and the new invite id. */
const issueInvite = async (adminToken: string, email: string, role = 'ADMIN') => {
    const res = await api.post('/api/v1/auth/invites', adminToken).send({ email, role });
    expect(res.status).toBe(201);
    return { token: res.body.data.token as string, id: res.body.data.invite.id as string };
};

/** Accepts an invite through the public endpoint. */
const accept = (token: string, overrides: Record<string, unknown> = {}) =>
    api.post('/api/v1/auth/accept-invite').send({ token, name: 'Jane Teacher', password: 'Teacher@123', ...overrides });

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('public registration is closed (DEC-02)', () => {
    test('POST /api/v1/auth/register is refused with 403 and creates no institute or user', async () => {
        const instituteCount = await prisma.institute.count();
        const userCount = await prisma.user.count();

        const res = await api.post('/api/v1/auth/register').send({
            instituteName: 'Open Signup Co',
            email: 'open-signup@integration.test',
            password: 'Open@12345',
        });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Public registration is disabled. An invitation is required.');
        expect(await prisma.institute.count()).toBe(instituteCount);
        expect(await prisma.user.count()).toBe(userCount);
    });

    test('a refused registration is logged as authorization_denied, without the password', async () => {
        const warn = jest.spyOn(logger, 'warn');

        await api.post('/api/v1/auth/register').send({
            instituteName: 'Open Signup Co',
            email: 'open-signup@integration.test',
            password: 'Open@12345',
        });

        const entries = warn.mock.calls.filter(([message]) => message === 'security_event').map(([, entry]) => entry);
        expect(entries).toContainEqual(
            expect.objectContaining({
                event: 'authorization_denied',
                action: 'POST /api/v1/auth/register',
                reason: 'public_registration_disabled',
            })
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain('Open@12345');
    });
});

describe('issuing a user invite (ADMIN, DEC-02)', () => {
    test('201 with the raw token once. Only its SHA-256 hash is stored, and the institute is the token institute', async () => {
        const res = await api
            .post('/api/v1/auth/invites', fx.a.adminToken)
            .send({ email: 'new-teacher@integration.test', role: 'ADMIN', instituteId: fx.b.institute.id });

        expect(res.status).toBe(201);
        const token: string = res.body.data.token;
        expect(token).toMatch(/^[0-9a-f]{64}$/);

        const row = await prisma.userInvite.findUniqueOrThrow({ where: { id: res.body.data.invite.id } });
        expect(row.tokenHash).toBe(sha256(token));
        expect(row.instituteId).toBe(fx.a.institute.id);
        expect(JSON.stringify(row)).not.toContain(token);
    });

    test('expiresAt defaults to about 7 days when omitted, and an expiry beyond 30 days is refused', async () => {
        const res = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'a@integration.test', role: 'STUDENT' });
        expect(res.status).toBe(201);
        const days = (new Date(res.body.data.invite.expiresAt).getTime() - Date.now()) / DAY_MS;
        expect(days).toBeGreaterThan(6.9);
        expect(days).toBeLessThan(7.1);

        const tooFar = await api
            .post('/api/v1/auth/invites', fx.a.adminToken)
            .send({ email: 'b@integration.test', role: 'ADMIN', expiresAt: new Date(Date.now() + 60 * DAY_MS).toISOString() });
        expect(tooFar.status).toBe(400);
    });

    test('an invalid email or role is refused with 400', async () => {
        const badEmail = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'nope', role: 'ADMIN' });
        const badRole = await api
            .post('/api/v1/auth/invites', fx.a.adminToken)
            .send({ email: 'ok@integration.test', role: 'OWNER' });

        expect(badEmail.status).toBe(400);
        expect(badRole.status).toBe(400);
    });

    test('the issue is logged as sensitive_admin_action with the invite id, and the token is not logged', async () => {
        const warn = jest.spyOn(logger, 'warn');

        const res = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'log@integration.test', role: 'ADMIN' });

        const entries = warn.mock.calls.filter(([message]) => message === 'security_event').map(([, entry]) => entry);
        expect(entries).toContainEqual(
            expect.objectContaining({
                event: 'sensitive_admin_action',
                action: 'create_user_invite',
                resourceType: 'user_invite',
                resourceId: res.body.data.invite.id,
            })
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain(res.body.data.token);
    });

    test('a STUDENT gets 403, and an unauthenticated request gets 401, and no invite is created', async () => {
        const inviteCount = await prisma.userInvite.count();

        const asStudent = await api.post('/api/v1/auth/invites', fx.a.studentToken).send({ email: 'x@integration.test', role: 'ADMIN' });
        const anonymous = await api.post('/api/v1/auth/invites').send({ email: 'x@integration.test', role: 'ADMIN' });

        expect(asStudent.status).toBe(403);
        expect(anonymous.status).toBe(401);
        expect(await prisma.userInvite.count()).toBe(inviteCount);
    });
});

describe('listing user invites (ADMIN, DEC-02)', () => {
    test('lists only the caller institute, and never returns a token, a token hash, or another institute invite', async () => {
        const ownInvite = await issueInvite(fx.a.adminToken, 'listed-a@integration.test');
        await issueInvite(fx.b.adminToken, 'listed-b@integration.test');

        const res = await api.get('/api/v1/auth/invites', fx.a.adminToken);

        expect(res.status).toBe(200);
        const ids = res.body.data.map((row: { id: string }) => row.id);
        expect(ids).toContain(ownInvite.id);
        expect(res.body.data.every((row: { email: string }) => row.email !== 'listed-b@integration.test')).toBe(true);
        const text = bodyText(res);
        expect(text).not.toContain(ownInvite.token);
        expect(text).not.toMatch(/tokenHash|"token"/);
    });

    test('a STUDENT gets 403 and an unauthenticated request gets 401 on the list', async () => {
        expect(DENIED_STATUSES).toContain((await api.get('/api/v1/auth/invites', fx.a.studentToken)).status);
        expect((await api.get('/api/v1/auth/invites')).status).toBe(401);
    });
});

describe('revoking a user invite (ADMIN, DEC-02)', () => {
    test('an ADMIN revokes a pending invite of their own institute, and it can no longer be accepted', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'revoke-me@integration.test');

        const revoked = await api.delete(`/api/v1/auth/invites/${invite.id}`, fx.a.adminToken);
        expect(revoked.status).toBe(200);

        const row = await prisma.userInvite.findUniqueOrThrow({ where: { id: invite.id } });
        expect(row.isActive).toBe(false);
        expect((await accept(invite.token)).status).toBe(400);
    });

    test('revoking the same invite twice reports not found the second time', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'twice@integration.test');

        expect((await api.delete(`/api/v1/auth/invites/${invite.id}`, fx.a.adminToken)).status).toBe(200);
        expect((await api.delete(`/api/v1/auth/invites/${invite.id}`, fx.a.adminToken)).status).toBe(404);
    });

    test('a STUDENT gets 403 and an unauthenticated request gets 401 on revoke, and the invite stays usable', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'stay@integration.test');

        expect((await api.delete(`/api/v1/auth/invites/${invite.id}`, fx.a.studentToken)).status).toBe(403);
        expect((await api.delete(`/api/v1/auth/invites/${invite.id}`)).status).toBe(401);

        const row = await prisma.userInvite.findUniqueOrThrow({ where: { id: invite.id } });
        expect(row.isActive).toBe(true);
    });

    test('cross-tenant: Admin A cannot revoke Institute B\'s invite (404), and B\'s invite stays active', async () => {
        const bInvite = await issueInvite(fx.b.adminToken, 'b-only@integration.test');

        const res = await api.delete(`/api/v1/auth/invites/${bInvite.id}`, fx.a.adminToken);

        expect(res.status).toBe(404);
        const row = await prisma.userInvite.findUniqueOrThrow({ where: { id: bInvite.id } });
        expect(row.isActive).toBe(true);
        expect((await accept(bInvite.token, { name: 'B Person' })).status).toBe(201);
    });
});

describe('accepting an invite (public, token-bound, DEC-02)', () => {
    test('201 creates the user in the invited institute with the invited role, and the new user can log in', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'joiner@integration.test', 'ADMIN');

        const res = await accept(invite.token, { password: 'Joiner@123' });

        expect(res.status).toBe(201);
        expect(res.body.data).toEqual(
            expect.objectContaining({ email: 'joiner@integration.test', role: 'ADMIN', instituteId: fx.a.institute.id })
        );
        expect(bodyText(res)).not.toContain('Joiner@123');

        const login = await api.post('/api/v1/auth/login').send({ email: 'joiner@integration.test', password: 'Joiner@123' });
        expect(login.status).toBe(200);
    });

    test('the invite is single use: a second accept is refused with the generic message and creates no second user', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'once@integration.test');
        expect((await accept(invite.token)).status).toBe(201);

        const again = await accept(invite.token);

        expect(again.status).toBe(400);
        expect(again.body.message).toBe(INVITE_REFUSAL);
        expect(await prisma.user.count({ where: { email: 'once@integration.test' } })).toBe(1);
    });

    test('an unknown token is refused with the same generic message, and the token is not echoed', async () => {
        const res = await accept('f'.repeat(64));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(INVITE_REFUSAL);
        expect(bodyText(res)).not.toContain('f'.repeat(64));
    });

    test('an expired invite is refused with the same generic message', async () => {
        const token = 'e'.repeat(64);
        await prisma.userInvite.create({
            data: {
                email: 'expired@integration.test',
                role: 'ADMIN',
                tokenHash: sha256(token),
                expiresAt: new Date(Date.now() - DAY_MS),
                instituteId: fx.a.institute.id,
            },
        });

        const res = await accept(token);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(INVITE_REFUSAL);
        expect(await prisma.user.count({ where: { email: 'expired@integration.test' } })).toBe(0);
    });

    test('an invite whose institute is inactive is refused, and no user is created', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'closed-institute@integration.test');
        await prisma.institute.update({ where: { id: fx.a.institute.id }, data: { isActive: false } });

        const res = await accept(invite.token);

        expect(res.status).toBe(400);
        expect(await prisma.user.count({ where: { email: 'closed-institute@integration.test' } })).toBe(0);
    });

    test('an invite for an email that already has an account is refused, and the account is unchanged', async () => {
        const invite = await issueInvite(fx.a.adminToken, fx.a.admin.email);
        const before = await prisma.user.findUniqueOrThrow({ where: { email: fx.a.admin.email } });

        const res = await accept(invite.token);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(INVITE_REFUSAL);
        const after = await prisma.user.findUniqueOrThrow({ where: { email: fx.a.admin.email } });
        expect(after.password).toBe(before.password);
        expect(await prisma.userInvite.findFirstOrThrow({ where: { email: fx.a.admin.email } }).then((r) => r.consumedAt)).toBeNull();
    });

    test('the token in the URL is not accepted: a request with no body token is a 400', async () => {
        const invite = await issueInvite(fx.a.adminToken, 'query@integration.test');

        const res = await api
            .post(`/api/v1/auth/accept-invite?token=${invite.token}`)
            .send({ name: 'Jane', password: 'Query@123' });

        expect(res.status).toBe(400);
        expect(await prisma.user.count({ where: { email: 'query@integration.test' } })).toBe(0);
    });

    test('a refused accept is logged as invite_validation_failed without the token', async () => {
        const warn = jest.spyOn(logger, 'warn');

        const res = await accept('d'.repeat(64));

        expect(res.status).toBe(400);
        const entries = warn.mock.calls.filter(([message]) => message === 'security_event').map(([, entry]) => entry);
        expect(entries).toContainEqual(
            expect.objectContaining({
                event: 'invite_validation_failed',
                action: 'accept_user_invite',
                reason: INVITE_REFUSAL,
            })
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain('d'.repeat(64));
    });
});
