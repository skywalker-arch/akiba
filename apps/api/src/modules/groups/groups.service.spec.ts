import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  const prisma = {
    groupMembership: {
      findUnique: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the current wallet balance from the database for active group members', async () => {
    const service = new GroupsService(prisma as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.ACTIVE,
    });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      groupId: 'group-1',
      currency: 'KES',
      balance: 27500,
    });

    const result = await service.getGroupBalance('user-1', 'group-1');

    expect(result).toEqual({ amount: 27500, currency: 'KES' });
    expect(prisma.wallet.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_currency: { groupId: 'group-1', currency: 'KES' } },
      }),
    );
  });

  it('rejects non-members from reading the group wallet balance', async () => {
    const service = new GroupsService(prisma as any);

    prisma.groupMembership.findUnique.mockResolvedValue(null);

    await expect(service.getGroupBalance('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
