import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a healthy status when the database is reachable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const controller = new HealthController(prisma as any);

    await expect(controller.getHealth()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        database: 'connected',
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
