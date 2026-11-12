import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resolveHelpScreen, useHelpScreen, useHelpScreenStore, HELP_SCREEN_TITLES } from './helpScreens';

describe('resolveHelpScreen', () => {
  it('maps the dashboard by role', () => {
    expect(resolveHelpScreen('/dashboard', 'program_coordinator')).toBe('pc-dashboard');
    expect(resolveHelpScreen('/dashboard', 'reader')).toBe('reader-dashboard');
    expect(resolveHelpScreen('/dashboard', 'lead_reader')).toBe('lead-dashboard');
    expect(resolveHelpScreen('/dashboard', 'admin')).toBe('admin-dashboard');
    expect(resolveHelpScreen('/dashboard', 'board')).toBe('board-dashboard');
    expect(resolveHelpScreen('/', 'board')).toBe('board-dashboard');
  });
  it('maps every routed screen', () => {
    expect(resolveHelpScreen('/self-study/abc', 'program_coordinator')).toBe('self-study-home');
    expect(resolveHelpScreen('/reader', 'reader')).toBe('reader-queue');
    expect(resolveHelpScreen('/reader/abc', 'reader')).toBe('reader-review');
    expect(resolveHelpScreen('/reader-report/abc', 'reader')).toBe('reader-report');
    expect(resolveHelpScreen('/reader-report/abc', 'lead_reader')).toBe('reader-report-lead');
    expect(resolveHelpScreen('/lead-reader', 'lead_reader')).toBe('lead-compilations');
    expect(resolveHelpScreen('/lead-reader/abc', 'lead_reader')).toBe('lead-compilation');
    expect(resolveHelpScreen('/site-visit/abc/checklist', 'lead_reader')).toBe('site-visit-checklist');
    expect(resolveHelpScreen('/site-visit/abc/itinerary', 'lead_reader')).toBe('site-visit-itinerary');
    expect(resolveHelpScreen('/board/lead-reader-reports/abc', 'board')).toBe('board-report');
    expect(resolveHelpScreen('/admin/board', 'admin')).toBe('admin-board-console');
    expect(resolveHelpScreen('/admin/audit-trail', 'admin')).toBe('admin-audit-trail');
    expect(resolveHelpScreen('/admin/joint-ventures', 'admin')).toBe('admin-joint-ventures');
    expect(resolveHelpScreen('/messages/abc', 'reader')).toBe('messages');
    expect(resolveHelpScreen('/relay', 'admin')).toBe('relay');
    expect(resolveHelpScreen('/nowhere', 'admin')).toBeNull();
  });
  it('every resolvable id has a title', () => {
    for (const id of ['pc-dashboard', 'reader-report-lead', 'board-report', 'settings-api-keys', 'editor-review', 'editor-submit']) {
      expect(HELP_SCREEN_TITLES[id]).toBeTruthy();
    }
  });
});

describe('useHelpScreen', () => {
  it('sets the override while mounted and clears it on unmount', () => {
    const { rerender, unmount } = renderHook(({ id }) => useHelpScreen(id), { initialProps: { id: 'editor-review' } });
    expect(useHelpScreenStore.getState().override).toBe('editor-review');
    rerender({ id: 'editor-files' });
    expect(useHelpScreenStore.getState().override).toBe('editor-files');
    unmount();
    expect(useHelpScreenStore.getState().override).toBeNull();
  });
});
