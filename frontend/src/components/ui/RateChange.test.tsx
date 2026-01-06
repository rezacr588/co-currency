import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RateChange } from './RateChange';

describe('RateChange', () => {
  it('should show positive change with rate-up class', () => {
    const { container } = render(
      <RateChange currentRate={1.1} previousRate={1.0} />
    );
    expect(container.querySelector('.rate-up')).toBeInTheDocument();
    expect(screen.getByText(/\+10\.00%/)).toBeInTheDocument();
  });

  it('should show negative change with rate-down class', () => {
    const { container } = render(
      <RateChange currentRate={0.9} previousRate={1.0} />
    );
    expect(container.querySelector('.rate-down')).toBeInTheDocument();
    expect(screen.getByText(/-10\.00%/)).toBeInTheDocument();
  });

  it('should show neutral with rate-neutral class when rates are equal', () => {
    const { container } = render(
      <RateChange currentRate={1.0} previousRate={1.0} />
    );
    expect(container.querySelector('.rate-neutral')).toBeInTheDocument();
    expect(screen.getByText(/0\.00%/)).toBeInTheDocument();
  });

  it('should hide percentage when showPercent is false', () => {
    render(
      <RateChange currentRate={1.1} previousRate={1.0} showPercent={false} />
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('should render arrow by default', () => {
    const { container } = render(
      <RateChange currentRate={1.1} previousRate={1.0} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should hide arrow when showArrow is false', () => {
    const { container } = render(
      <RateChange currentRate={1.1} previousRate={1.0} showArrow={false} />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('should calculate correct percentage for large changes', () => {
    render(<RateChange currentRate={200} previousRate={100} />);
    expect(screen.getByText(/\+100\.00%/)).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(
      <RateChange
        currentRate={1.0}
        previousRate={1.0}
        className="custom-class"
      />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
