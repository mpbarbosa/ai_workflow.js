import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorDetailPanel, { ErrorDetailPanelProps, ErrorDetailPanelError } from '../../../src/cli/tui/components/ErrorDetailPanel';

describe('ErrorDetailPanel', () => {
  const baseError: ErrorDetailPanelError = {
    stepId: 'step-1',
    stepName: 'Build Project',
    message: 'Build failed due to syntax error',
    stack: 'Error: SyntaxError\n    at build (index.js:10:5)\n    at main (index.js:20:3)',
  };

  const renderPanel = (props?: Partial<ErrorDetailPanelProps>) => {
    const onClose = jest.fn();
    render(
      <ErrorDetailPanel
        error={props?.error ?? baseError}
        onClose={props?.onClose ?? onClose}
      />
    );
    return { onClose };
  };

  it('renders error details when error is provided', () => {
    renderPanel();
    expect(screen.getByText('Build Project')).toBeInTheDocument();
    expect(screen.getByText('Build failed due to syntax error')).toBeInTheDocument();
    expect(screen.getByText(/SyntaxError/)).toBeInTheDocument();
  });

  it('renders truncated stack trace if stack is long', () => {
    const longStack = Array(50).fill('at foo (bar.js:1:1)').join('\n');
    renderPanel({ error: { ...baseError, stack: longStack } });
    // Should show at least the first line
    expect(screen.getByText(/at foo \(bar\.js:1:1\)/)).toBeInTheDocument();
    // Should not render the entire stack (simulate truncation)
    // (Assume helper truncates after 10 lines)
    expect(screen.queryByText((content, element) => {
      return content.includes('at foo (bar.js:1:1)') && element?.textContent?.split('\n').length! > 20;
    })).not.toBeInTheDocument();
  });

  it('handles null stack gracefully', () => {
    renderPanel({ error: { ...baseError, stack: null } });
    expect(screen.getByText('Build Project')).toBeInTheDocument();
    expect(screen.getByText('Build failed due to syntax error')).toBeInTheDocument();
    expect(screen.queryByText(/at /)).not.toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when "e" key is pressed', () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(document, { key: 'e', code: 'KeyE' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render panel when error is null', () => {
    renderPanel({ error: null });
    expect(screen.queryByText('Build Project')).not.toBeInTheDocument();
    expect(screen.queryByText('Build failed due to syntax error')).not.toBeInTheDocument();
  });

  it('renders with minimal error object', () => {
    const minimalError: ErrorDetailPanelError = {
      stepId: '',
      stepName: '',
      message: '',
      stack: null,
    };
    renderPanel({ error: minimalError });
    expect(screen.getByText('')).toBeInTheDocument();
  });
});
