/**
 * Mail delivery behind a small transport interface.
 *
 * The only place that sees the raw invite token. Messages are built here, in memory, and handed to the transport.
 * No SMTP library is installed yet, so the default transport outside tests refuses to send. Each job then fails
 * with `mail_transport_not_configured`, is retried, and ends in the dead-letter list. A real transport (SMTP or a
 * provider API) is set with setMailTransport at startup.
 */

import { env } from '../../config/env';
import { NotificationJobMeta } from './notification.types';

export interface MailMessage {
    to: string;
    subject: string;
    text: string;
}

export interface MailTransport {
    readonly name: string;
    send(message: MailMessage): Promise<void>;
}

/** A delivery failure carries a short code only. The provider's message may echo the recipient, so it is not kept. */
export class MailDeliveryError extends Error {
    constructor(readonly code: string) {
        super(code);
        this.name = 'MailDeliveryError';
    }
}

/** Builds the message for a job. The token is in the body and nowhere else. */
export const buildInviteMessage = (meta: NotificationJobMeta, rawToken: string): MailMessage => {
    const isCandidate = meta.type === 'SEND_TEST_INVITE';
    return {
        to: meta.recipientEmail,
        subject: isCandidate ? 'You have been invited to take an assessment' : 'You have been invited to join your institute',
        text: isCandidate
            ? `Use this one-time invite token to start your assessment: ${rawToken}\n`
            : `Use this one-time invite token to accept your invitation: ${rawToken}\n`,
    };
};

/** Default outside tests: no provider is configured, so every send is refused. */
export class UnconfiguredMailTransport implements MailTransport {
    readonly name = 'unconfigured';

    async send(): Promise<void> {
        throw new MailDeliveryError('mail_transport_not_configured');
    }
}

/** Test transport: records each sent message, and can be told to fail the next N sends. */
export class MemoryMailTransport implements MailTransport {
    readonly name = 'memory';
    readonly sent: MailMessage[] = [];
    private failuresLeft = 0;

    failNext(count: number): void {
        this.failuresLeft = count;
    }

    async send(message: MailMessage): Promise<void> {
        if (this.failuresLeft > 0) {
            this.failuresLeft -= 1;
            throw new MailDeliveryError('simulated_transport_failure');
        }
        this.sent.push(message);
    }

    reset(): void {
        this.sent.length = 0;
        this.failuresLeft = 0;
    }
}

let activeTransport: MailTransport =
    env.NODE_ENV === 'test' ? new MemoryMailTransport() : new UnconfiguredMailTransport();

export const getMailTransport = (): MailTransport => activeTransport;

export const setMailTransport = (transport: MailTransport): void => {
    activeTransport = transport;
};
