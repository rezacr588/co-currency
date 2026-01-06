import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('should render children', () => {
    render(<StatusBadge>Active</StatusBadge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should apply success variant styles', () => {
    render(<StatusBadge variant="success">Success</StatusBadge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('status-success');
  });

  it('should apply error variant styles', () => {
    render(<StatusBadge variant="error">Error</StatusBadge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('status-error');
  });

  it('should apply warning variant styles', () => {
    render(<StatusBadge variant="warning">Warning</StatusBadge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('status-warning');
  });

  it('should apply info variant styles', () => {
    render(<StatusBadge variant="info">Info</StatusBadge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('status-info');
  });

  it('should render with icon', () => {
    render(
      <StatusBadge icon={<span data-testid="icon">✓</span>}>
        With Icon
      </StatusBadge>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('With Icon')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    render(<StatusBadge className="custom-class">Custom</StatusBadge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-class');
  });
});
