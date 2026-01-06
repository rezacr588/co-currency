import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('should render error message', () => {
    render(<ErrorMessage>Something went wrong</ErrorMessage>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should have alert role for accessibility', () => {
    render(<ErrorMessage>Error</ErrorMessage>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should render with title', () => {
    render(
      <ErrorMessage title="Connection Failed">
        Unable to reach the server
      </ErrorMessage>
    );
    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByText('Unable to reach the server')).toBeInTheDocument();
  });

  it('should render retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(
      <ErrorMessage onRetry={onRetry}>
        Failed to load data
      </ErrorMessage>
    );
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <ErrorMessage onRetry={onRetry}>
        Failed to load data
      </ErrorMessage>
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should use custom retry label', () => {
    render(
      <ErrorMessage onRetry={() => {}} retryLabel="Try Again">
        Error occurred
      </ErrorMessage>
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<ErrorMessage>Error</ErrorMessage>);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should apply error-message class', () => {
    render(<ErrorMessage>Error</ErrorMessage>);
    expect(screen.getByRole('alert')).toHaveClass('error-message');
  });
});
