import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { TaskEditModal } from '../TaskEditModal';
import type { Task } from '../../../../types/planner';

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined }),
}));

jest.mock('../../../../utils/haptics', () => ({
  haptics: {
    success: jest.fn(),
    error: jest.fn(),
    light: jest.fn(),
    selection: jest.fn(),
  },
}));

jest.mock('../../../../components/features/Planner/DatePickerModal', () => ({
  DatePickerModal: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const theme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('TaskEditModal', () => {
  const task: Task = {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Launch planner refresh',
    description: 'Keep reminder mode intact',
    status: 'todo',
    priority: 'medium',
    due_date: '2026-03-01T00:00:00Z',
    reminder_mode: 'aggressive',
    auto_ledger_enabled: false,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  };

  it('preserves reminder mode when saving unrelated edits', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const view = renderWithTheme(
      <TaskEditModal
        visible
        task={task}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.changeText(view.getByDisplayValue('Launch planner refresh'), 'Launch planner refresh v2');
    fireEvent.press(view.getByText('Save Changes'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          title: 'Launch planner refresh v2',
          reminder_mode: 'aggressive',
          due_date: '2026-03-01',
        })
      );
    });
  });
});
