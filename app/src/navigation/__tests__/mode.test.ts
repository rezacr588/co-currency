import {
  MODE_DEFAULT_ROUTE,
  getCompatibilityRedirectTarget,
  getModeFromPath,
  getModeEntryRedirect,
  isFinAppPath,
  rememberModeRoute,
} from '../mode';

const mockReadStorage = jest.fn();
const mockWriteStorage = jest.fn();

jest.mock('../../utils/storage', () => ({
  readStorage: (...args: unknown[]) => mockReadStorage(...args),
  writeStorage: (...args: unknown[]) => mockWriteStorage(...args),
}));

describe('mode routing persistence', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not persist finapp transient routes', async () => {
    await rememberModeRoute('finapp', '/transaction-create');
    expect(mockWriteStorage).not.toHaveBeenCalled();
  });

  it('ignores a stored transaction-create route when resolving finapp entry redirects', async () => {
    mockReadStorage.mockResolvedValue('/transaction-create');

    await expect(getModeEntryRedirect('finapp')).resolves.toBe(MODE_DEFAULT_ROUTE.finapp);
  });

  it('redirects legacy chat entry points into the CoAI chat surface', () => {
    expect(getCompatibilityRedirectTarget('/chat')).toBe('/(app)/coai-chat');
    expect(getCompatibilityRedirectTarget('/(app)/(tabs)/chat')).toBe('/(app)/coai-chat');
  });

  it('treats the CoAI chat surface as a finapp route', () => {
    expect(isFinAppPath('/(app)/coai-chat')).toBe(true);
  });

  it('treats the landing page as a public route', () => {
    expect(isFinAppPath('/')).toBe(false);
    expect(getModeFromPath('/')).toBeNull();
  });
});
