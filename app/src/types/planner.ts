export type PlannerStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type PlannerItemType = 'task' | 'goal';

export interface TaskSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: PlannerStatus;
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  goal_id?: string;
  transaction_id?: string;
  sort_order?: number;
  subtasks?: TaskSubtask[];
  reminder_mode?: 'off' | 'aggressive';
  reminder_next_at?: string;
  auto_ledger_enabled?: boolean;
  ledger_type?: 'credit' | 'debit';
  ledger_amount?: number;
  ledger_currency?: string;
  ledger_wallet_currency?: string;
  ledger_category?: string;
  ledger_description?: string;
  created_at: string;
  updated_at: string;
}

export interface TodoItem {
  id: string;
  type: PlannerItemType;
  title: string;
  description?: string;
  status: PlannerStatus;
  priority?: string;
  sort_order?: number;
  due_date?: string;
  goal_id?: string;
  transaction_id?: string;
  progress?: number;
  goal_type?: string;
  category?: string;
  unit?: string;
  created_at: string;
  updated_at: string;
}

export interface PlannerColumn {
  status: PlannerStatus;
  items: TodoItem[];
}

export interface PlannerBoardResponse {
  columns: PlannerColumn[];
  summary: {
    total: number;
    todo: number;
    in_progress: number;
    done: number;
    archived: number;
  };
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: PlannerStatus;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  goal_id?: string;
  transaction_id?: string;
  sort_order?: number;
  subtasks?: TaskSubtask[];
  reminder_mode?: 'off' | 'aggressive';
  auto_ledger_enabled?: boolean;
  ledger_type?: 'credit' | 'debit';
  ledger_amount?: number;
  ledger_currency?: string;
  ledger_wallet_currency?: string;
  ledger_category?: string;
  ledger_description?: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {}

export interface MovePlannerItemRequest {
  status: PlannerStatus;
  sort_order: number;
}

export interface GoalFundingRequired {
  goal_id: string;
  remaining: number;
  currency: string;
  message: string;
  error_code: 'goal_funding_required' | string;
}
