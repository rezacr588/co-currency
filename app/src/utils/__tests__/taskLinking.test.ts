import { linkTaskToTransactionIfNeeded } from '../taskLinking';

describe('linkTaskToTransactionIfNeeded', () => {
  it('links a task when both ids are present', async () => {
    const updateTask = jest.fn().mockResolvedValue(undefined);

    const linked = await linkTaskToTransactionIfNeeded({
      linkedTaskID: 'task-1',
      transactionID: 'tx-1',
      updateTask,
    });

    expect(linked).toBe(true);
    expect(updateTask).toHaveBeenCalledWith('task-1', { transaction_id: 'tx-1' });
  });

  it('skips when linked task id is missing', async () => {
    const updateTask = jest.fn().mockResolvedValue(undefined);

    const linked = await linkTaskToTransactionIfNeeded({
      linkedTaskID: '',
      transactionID: 'tx-1',
      updateTask,
    });

    expect(linked).toBe(false);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('skips when transaction id is missing', async () => {
    const updateTask = jest.fn().mockResolvedValue(undefined);

    const linked = await linkTaskToTransactionIfNeeded({
      linkedTaskID: 'task-1',
      transactionID: '   ',
      updateTask,
    });

    expect(linked).toBe(false);
    expect(updateTask).not.toHaveBeenCalled();
  });
});
