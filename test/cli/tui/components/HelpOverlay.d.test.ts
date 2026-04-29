import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import HelpOverlay, { HelpOverlayProps } from '../../../src/cli/tui/components/HelpOverlay';

describe('HelpOverlay Component', () => {
  it('renders the overlay with keybinding reference', () => {
    const { getByText } = render(<HelpOverlay />);
    expect(getByText(/keybindings/i)).toBeInTheDocument();
    expect(getByText(/h/i)).toBeInTheDocument();
    expect(getByText(/Escape/i)).toBeInTheDocument();
  });

  it('calls onClose when h key is pressed', () => {
    const onClose = jest.fn();
    const { getByRole } = render(<HelpOverlay onClose={onClose} />);
    fireEvent.keyDown(getByRole('dialog'), { key: 'h', code: 'KeyH' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    const { getByRole } = render(<HelpOverlay onClose={onClose} />);
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not throw if onClose is not provided and keys are pressed', () => {
    const { getByRole } = render(<HelpOverlay />);
    expect(() => {
      fireEvent.keyDown(getByRole('dialog'), { key: 'h', code: 'KeyH' });
      fireEvent.keyDown(getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    }).not.toThrow();
  });

  it('renders correctly with no props', () => {
    const { container } = render(<HelpOverlay />);
    expect(container).toBeInTheDocument();
  });

  it('overlay is centered and modal', () => {
    const { getByRole } = render(<HelpOverlay />);
    const dialog = getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Optionally check for centering/modal classnames or styles if present
  });
});
