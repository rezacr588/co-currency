import { prepareDashboardPostAuthRoute } from '../mode';
import { writeStorage } from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  readStorage: jest.fn(),
  writeStorage: jest.fn(() => Promise.resolve(true)),
}));

describe('prepareDashboardPostAuthRoute', () => {
  it('pins post-auth routing to the finapp dashboard entry', async () => {
    const target = await prepareDashboardPostAuthRoute();

    expect(writeStorage).toHaveBeenNthCalledWith(1, 'current_mode', 'finapp');
    expect(writeStorage).toHaveBeenNthCalledWith(2, 'last_route_finapp', '/(app)/(tabs)');
    expect(target).toBe('/finapp');
  });
});
