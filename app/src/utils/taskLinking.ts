import type { UpdateTaskRequest } from '../types/planner';

interface LinkTaskToTransactionParams {
  linkedTaskID?: string | null;
  transactionID?: string | null;
  updateTask: (taskID: string, data: UpdateTaskRequest) => Promise<unknown>;
}

export async function linkTaskToTransactionIfNeeded({
  linkedTaskID,
  transactionID,
  updateTask,
}: LinkTaskToTransactionParams): Promise<boolean> {
  const taskID = linkedTaskID?.trim();
  const txID = transactionID?.trim();

  if (!taskID || !txID) {
    return false;
  }

  await updateTask(taskID, { transaction_id: txID });
  return true;
}
