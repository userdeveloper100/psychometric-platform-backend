import { buildInviteMessage, MailDeliveryError, MemoryMailTransport, UnconfiguredMailTransport } from './mailer.service';
import { buildJobMeta } from './notification.types';

const RAW_TOKEN = 'c'.repeat(64);
const meta = (type: 'SEND_TEST_INVITE' | 'SEND_USER_INVITE') =>
    buildJobMeta(
        { type, inviteId: 'invite-1', instituteId: 'institute-a', recipientEmail: 'person@example.com', inviteToken: RAW_TOKEN },
        'job-1',
        new Date('2026-11-26T10:00:00.000Z')
    );

describe('buildInviteMessage', () => {
    test('a candidate invite addresses the recipient and carries the token once in the body', () => {
        const message = buildInviteMessage(meta('SEND_TEST_INVITE'), RAW_TOKEN);

        expect(message.to).toBe('person@example.com');
        expect(message.subject).toMatch(/assessment/i);
        expect(message.text.split(RAW_TOKEN)).toHaveLength(2);
    });

    test('a staff invite uses its own wording and still carries the token only in the body', () => {
        const message = buildInviteMessage(meta('SEND_USER_INVITE'), RAW_TOKEN);

        expect(message.subject).toMatch(/join your institute/i);
        expect(message.text).toContain(RAW_TOKEN);
        expect(message.subject).not.toContain(RAW_TOKEN);
    });
});

describe('transports', () => {
    test('the unconfigured transport refuses to send, with a code and no provider message', async () => {
        const transport = new UnconfiguredMailTransport();

        const error = await transport.send().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(MailDeliveryError);
        expect((error as MailDeliveryError).code).toBe('mail_transport_not_configured');
    });

    test('the memory transport records each message, and fails exactly the number of sends it was told to', async () => {
        const transport = new MemoryMailTransport();
        const message = buildInviteMessage(meta('SEND_TEST_INVITE'), RAW_TOKEN);

        transport.failNext(1);
        await expect(transport.send(message)).rejects.toThrow('simulated_transport_failure');
        expect(transport.sent).toHaveLength(0);

        await transport.send(message);
        expect(transport.sent).toEqual([message]);
    });
});
