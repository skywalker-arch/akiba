import { Injectable } from '@nestjs/common';

@Injectable()
export class InvitationDeliveryService {
  async sendGroupInvitationEmail(_input: {
    toEmail: string;
    groupName: string;
    inviterName: string;
    invitationLink: string;
    expiresAt: Date;
    message?: string | null;
  }): Promise<{ delivered: boolean; channel: 'email' | 'none'; reason?: string }> {
    const provider = process.env.INVITATION_EMAIL_PROVIDER?.trim();

    if (!provider) {
      return {
        delivered: false,
        channel: 'none',
        reason:
          'No invitation email provider is configured. Share the invitation link directly.',
      };
    }

    return {
      delivered: false,
      channel: 'none',
      reason:
        'Configured invitation email provider integration is not implemented yet. Share the invitation link directly.',
    };
  }
}
