import {
  MODE_DEFAULT_ROUTE,
  getModeEntryRedirect,
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
});
