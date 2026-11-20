import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  GroupInvitationStatus,
  MembershipRole,
  MembershipStatus,
} from '@prisma/client';
import { GroupsService } from './groups.service';

describe('GroupsService invitations', () => {
  const deliveryService = {
    sendGroupInvitationEmail: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(),
    groupMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    groupInvitation: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    savingsGroup: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  function asManager() {
    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'actor-membership-1',
      role: MembershipRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    deliveryService.sendGroupInvitationEmail.mockResolvedValue({
      delivered: false,
      channel: 'none',
      reason: 'No email provider',
    });

    prisma.groupInvitation.updateMany.mockResolvedValue({ count: 0 });
    prisma.savingsGroup.findUnique.mockResolvedValue({ id: 'group-1', name: 'Alpha Group' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-admin',
      firstName: 'Jane',
      lastName: 'Wanjiku',
      email: 'jane@example.com',
      isActive: true,
    });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.groupMembership.findMany.mockResolvedValue([]);
    prisma.groupInvitation.findMany.mockResolvedValue([]);
  });

  it('creates an individual invitation', async () => {
    asManager();
    prisma.groupInvitation.create.mockResolvedValue({
      id: 'invite-1',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    const result = await service.createInvitations('user-admin', 'group-1', {
      email: 'member@example.com',
    });

    expect(result.invitedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(prisma.groupInvitation.create).toHaveBeenCalled();
  });

  it('creates bulk invitations up to limit', async () => {
    asManager();
    prisma.groupInvitation.create.mockResolvedValue({
      id: 'invite-1',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    const result = await service.createInvitations('user-admin', 'group-1', {
      emails: ['a@example.com', 'b@example.com', 'c@example.com'],
    });

    expect(result.requestedCount).toBe(3);
    expect(result.invitedCount).toBe(3);
  });

  it('rejects invalid email addresses', async () => {
    asManager();

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.createInvitations('user-admin', 'group-1', {
        email: 'not-an-email',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('skips duplicate pending invitations', async () => {
    asManager();
    prisma.groupInvitation.findMany.mockResolvedValue([
      { invitedEmail: 'member@example.com' },
    ]);

    const service = new GroupsService(prisma as any, deliveryService as any);

    const result = await service.createInvitations('user-admin', 'group-1', {
      email: 'member@example.com',
    });

    expect(result.skippedCount).toBe(1);
    expect(prisma.groupInvitation.create).not.toHaveBeenCalled();
  });

  it('skips invitations for existing group members', async () => {
    asManager();
    prisma.user.findMany.mockResolvedValue([
      { id: 'member-1', email: 'member@example.com' },
    ]);
    prisma.groupMembership.findMany.mockResolvedValue([
      { user: { email: 'member@example.com' } },
    ]);

    const service = new GroupsService(prisma as any, deliveryService as any);

    const result = await service.createInvitations('user-admin', 'group-1', {
      email: 'member@example.com',
    });

    expect(result.skippedCount).toBe(1);
    expect(result.results[0].reason).toContain('already a group member');
  });

  it('blocks unauthorized invitation creation', async () => {
    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'member-role-only',
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.createInvitations('user-1', 'group-1', {
        email: 'member@example.com',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('accepts a valid invitation', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@example.com',
      isActive: true,
    });

    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      role: MembershipRole.MEMBER,
    });
    prisma.groupMembership.findUnique.mockResolvedValue(null);
    prisma.groupInvitation.updateMany.mockResolvedValue({ count: 1 });
    prisma.groupMembership.create.mockResolvedValue({
      id: 'membership-1',
      role: MembershipRole.MEMBER,
      status: MembershipStatus.PENDING,
      createdAt: new Date(),
      group: { id: 'group-1', name: 'Alpha Group', code: 'ALPHA' },
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    const result = await service.acceptInvitation('valid-token-1234567890', 'user-1');

    expect(result.membership.status).toBe(MembershipStatus.PENDING);
    expect(prisma.groupMembership.create).toHaveBeenCalled();
  });

  it('rejects acceptance when authenticated email does not match invitation email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'someoneelse@example.com',
      isActive: true,
    });
    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      role: MembershipRole.MEMBER,
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.acceptInvitation('valid-token-1234567890', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects expired invitations', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@example.com',
      isActive: true,
    });
    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() - 1_000),
      role: MembershipRole.MEMBER,
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.acceptInvitation('valid-token-1234567890', 'user-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects revoked invitations', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@example.com',
      isActive: true,
    });
    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.REVOKED,
      expiresAt: new Date(Date.now() + 60_000),
      role: MembershipRole.MEMBER,
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.acceptInvitation('valid-token-1234567890', 'user-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents repeated acceptance', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@example.com',
      isActive: true,
    });
    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      role: MembershipRole.MEMBER,
    });
    prisma.groupMembership.findUnique.mockResolvedValue(null);
    prisma.groupInvitation.updateMany.mockResolvedValue({ count: 0 });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.acceptInvitation('valid-token-1234567890', 'user-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('blocks concurrent acceptance via atomic claim update', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@example.com',
      isActive: true,
    });
    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      role: MembershipRole.MEMBER,
    });
    prisma.groupMembership.findUnique.mockResolvedValue(null);
    prisma.groupInvitation.updateMany.mockResolvedValue({ count: 0 });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.acceptInvitation('valid-token-1234567890', 'user-1'),
    ).rejects.toThrow('already been processed');
  });

  it('blocks acceptance if user is already a member', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@example.com',
      isActive: true,
    });
    prisma.groupInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      groupId: 'group-1',
      invitedEmail: 'invitee@example.com',
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      role: MembershipRole.MEMBER,
    });
    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'membership-existing',
      status: MembershipStatus.ACTIVE,
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    await expect(
      service.acceptInvitation('valid-token-1234567890', 'user-1'),
    ).rejects.toThrow('already a member');
  });

  it('supports resending and revoking pending invitations', async () => {
    asManager();
    prisma.groupInvitation.findFirst.mockResolvedValue({
      id: 'invite-1',
      invitedEmail: 'member@example.com',
      message: null,
      status: GroupInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.groupInvitation.update.mockResolvedValue({
      id: 'invite-1',
      invitedEmail: 'member@example.com',
      expiresAt: new Date(Date.now() + 120_000),
      status: GroupInvitationStatus.PENDING,
      revokedAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new GroupsService(prisma as any, deliveryService as any);

    const resent = await service.resendInvitation('user-admin', 'group-1', 'invite-1');
    expect(resent.invitationLink).toContain('/invite/');

    await service.revokeInvitation('user-admin', 'group-1', 'invite-1');
    expect(prisma.groupInvitation.update).toHaveBeenCalled();
  });
});
