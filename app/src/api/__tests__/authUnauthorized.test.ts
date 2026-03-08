import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../auth';

describe('auth.login unauthorized handling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'invalid email or password' }),
    } as Response);
  });

  it('returns the backend credential error instead of a session-expired message', async () => {
    await expect(auth.login({ email: 'user@example.com', password: 'wrong-password' })).rejects.toThrow(
      'invalid email or password'
    );
  });
});
