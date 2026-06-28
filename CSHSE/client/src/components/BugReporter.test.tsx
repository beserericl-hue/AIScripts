/**
 * CR-016 / Sprint 7.2 — BugReporter view + console-capture unit tests.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  BugReporter,
  BugReporterView,
  installConsoleErrorCapture,
  _getCapturedConsoleErrorsForTest,
  _clearCapturedConsoleErrorsForTest,
} from './BugReporter';

const handlers = {
  onChangeDescription: vi.fn(),
  onOpen: vi.fn(),
  onClose: vi.fn(),
  onSubmit: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BugReporterView', () => {
  it('renders NO floating trigger; modal closed by default', () => {
    render(<BugReporterView {...handlers} isOpen={false} description="" />);
    // The floating "Report issue" button was removed — it now lives in the
    // header Settings menu (Layout), opened via the open-bug-reporter event.
    expect(screen.queryByTestId('bug-reporter-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bug-reporter-modal')).not.toBeInTheDocument();
  });

  it('opens the modal when the open-bug-reporter event fires', () => {
    render(<BugReporter />);
    expect(screen.queryByTestId('bug-reporter-modal')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('open-bug-reporter'));
    });
    expect(screen.getByTestId('bug-reporter-modal')).toBeInTheDocument();
  });

  it('opens the modal with description input + Send button disabled when empty', () => {
    render(<BugReporterView {...handlers} isOpen description="" />);
    expect(screen.getByTestId('bug-reporter-modal')).toBeInTheDocument();
    expect(screen.getByTestId('bug-reporter-description')).toBeInTheDocument();
    expect(screen.getByTestId('bug-reporter-submit')).toBeDisabled();
  });

  it('typing into description fires onChangeDescription', () => {
    const onChangeDescription = vi.fn();
    render(
      <BugReporterView
        {...handlers}
        onChangeDescription={onChangeDescription}
        isOpen
        description=""
      />
    );
    fireEvent.change(screen.getByTestId('bug-reporter-description'), {
      target: { value: 'Save did nothing' },
    });
    expect(onChangeDescription).toHaveBeenCalledWith('Save did nothing');
  });

  it('Send button fires onSubmit once non-empty', () => {
    const onSubmit = vi.fn();
    render(
      <BugReporterView
        {...handlers}
        onSubmit={onSubmit}
        isOpen
        description="real text"
      />
    );
    fireEvent.click(screen.getByTestId('bug-reporter-submit'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('Close button fires onClose', () => {
    const onClose = vi.fn();
    render(<BugReporterView {...handlers} onClose={onClose} isOpen description="x" />);
    fireEvent.click(screen.getByTestId('bug-reporter-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the thanks panel when reference is set', () => {
    render(
      <BugReporterView
        {...handlers}
        isOpen
        description=""
        reference="abc123"
      />
    );
    expect(screen.getByTestId('bug-reporter-thanks')).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    // Submission form hidden.
    expect(screen.queryByTestId('bug-reporter-description')).not.toBeInTheDocument();
  });

  it('renders an error banner when error is set', () => {
    render(
      <BugReporterView
        {...handlers}
        isOpen
        description="x"
        error="Network failed"
      />
    );
    expect(screen.getByTestId('bug-reporter-error')).toHaveTextContent('Network failed');
  });
});

describe('console-error capture', () => {
  beforeEach(() => {
    _clearCapturedConsoleErrorsForTest();
    installConsoleErrorCapture();
  });

  it('captures console.error calls into the rolling buffer', () => {
    // Suppress the original console.error noise during the test.
    const noop = () => undefined;
    const origError = console.error;
    (console as any).error = (...args: unknown[]) => {
      noop();
      // Manually invoke the patched function to exercise the capture.
      origError(...args);
    };
    console.error('Test error 1');
    console.error('Test error 2', { extra: 'context' });
    const captured = _getCapturedConsoleErrorsForTest();
    expect(captured.length).toBeGreaterThanOrEqual(2);
    expect(captured[captured.length - 2].message).toContain('Test error 1');
    expect(captured[captured.length - 1].message).toContain('Test error 2');
  });

  it('caps the buffer at 10 entries (oldest dropped)', () => {
    for (let i = 0; i < 15; i++) console.error(`err-${i}`);
    const captured = _getCapturedConsoleErrorsForTest();
    expect(captured.length).toBe(10);
    expect(captured[0].message).toContain('err-5');
    expect(captured[9].message).toContain('err-14');
  });
});
