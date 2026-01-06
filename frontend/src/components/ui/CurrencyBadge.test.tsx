import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CurrencyBadge } from './CurrencyBadge';

describe('CurrencyBadge', () => {
  it('should render currency code', () => {
    render(<CurrencyBadge code="USD" />);
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('should render flag by default', () => {
    render(<CurrencyBadge code="USD" />);
    expect(screen.getByText('🇺🇸')).toBeInTheDocument();
  });

  it('should hide flag when showFlag is false', () => {
    render(<CurrencyBadge code="USD" showFlag={false} />);
    expect(screen.queryByText('🇺🇸')).not.toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('should show symbol when showSymbol is true', () => {
    render(<CurrencyBadge code="EUR" showSymbol />);
    expect(screen.getByText('EUR')).toBeInTheDocument();
    expect(screen.getByText('(€)')).toBeInTheDocument();
  });

  it('should apply small size class', () => {
    const { container } = render(<CurrencyBadge code="GBP" size="sm" />);
    expect(container.querySelector('.text-xs')).toBeInTheDocument();
  });

  it('should apply large size class', () => {
    const { container } = render(<CurrencyBadge code="GBP" size="lg" />);
    expect(container.querySelector('.text-base')).toBeInTheDocument();
  });

  it('should apply currency-badge class', () => {
    const { container } = render(<CurrencyBadge code="JPY" />);
    expect(container.querySelector('.currency-badge')).toBeInTheDocument();
  });

  it('should handle unknown currencies with default flag', () => {
    render(<CurrencyBadge code="XYZ" />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
    expect(screen.getByText('XYZ')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(
      <CurrencyBadge code="USD" className="my-custom-class" />
    );
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument();
  });
});
