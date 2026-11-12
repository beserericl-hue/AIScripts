/**
 * Actions that take effect immediately now ask first:
 * API key Rotate / Revoke, Dashboard File delete, Help Document remove.
 * POSITIVE: confirming performs the request. NEGATIVE: cancelling sends nothing.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw-server';
import { APIKeySettings } from './APIKeySettings';
import { DashboardFileUpload } from './DashboardFileUpload';
import { HelpDocumentUpload } from './HelpDocumentUpload';

const wrap = (el: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>);
const key = { _id: 'k1', name: 'n8n callback', keyPrefix: 'csk_', keySuffix: 'abcd', keyMasked: 'csk_••••abcd', purpose: 'webhook', permissions: [], scope: 'general-api', isActive: true, usageCount: 3, createdAt: '2026-01-01T00:00:00Z', createdByName: 'Eric', version: '1', status: 'active' };

describe('API keys: Rotate / Revoke confirm first', () => {
  const setup = () => {
    const calls: string[] = [];
    server.use(
      http.get(/\/api\/admin\/api-keys$/, () => HttpResponse.json({ apiKeys: [key], keys: [key] })),
      http.post(/\/api\/admin\/api-keys\/k1\/rotate$/, () => { calls.push('rotate'); return HttpResponse.json({ apiKey: { key: 'NEWKEY', name: 'n8n callback', scope: 'general-api' } }); }),
      http.delete(/\/api\/admin\/api-keys\/k1$/, () => { calls.push('revoke'); return HttpResponse.json({ ok: true }); })
    );
    wrap(<APIKeySettings />);
    return calls;
  };
  it('NEGATIVE: Revoke then Cancel sends nothing', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('api-key-revoke-k1'));
    expect(screen.getByTestId('api-key-confirm')).toHaveTextContent('stops working immediately and cannot be restored');
    fireEvent.click(screen.getByTestId('api-key-confirm-cancel'));
    expect(screen.queryByTestId('api-key-confirm')).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });
  it('POSITIVE: Rotate then confirm rotates the key', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('api-key-rotate-k1'));
    expect(screen.getByTestId('api-key-confirm')).toHaveTextContent('current key stops working immediately');
    fireEvent.click(screen.getByTestId('api-key-confirm-confirm'));
    await waitFor(() => expect(calls).toEqual(['rotate']));
  });
  it('POSITIVE: Revoke then confirm revokes the key', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('api-key-revoke-k1'));
    fireEvent.click(screen.getByTestId('api-key-confirm-confirm'));
    await waitFor(() => expect(calls).toEqual(['revoke']));
  });
});

describe('Dashboard Files: delete confirms first', () => {
  const setup = () => {
    const calls: string[] = [];
    server.use(
      http.get(/\/api\/specs$/, () => HttpResponse.json({ specs: [] })),
      http.get(/\/api\/files$/, () => HttpResponse.json({ files: [{ _id: 'f1', originalName: 'ASSOCIATE DEGREE v2025.pdf', mimeType: 'application/pdf', size: 1000, createdAt: '2026-01-01T00:00:00Z' }] })),
      http.delete(/\/api\/files\/f1$/, () => { calls.push('delete'); return HttpResponse.json({ ok: true }); })
    );
    wrap(<DashboardFileUpload />);
    return calls;
  };
  it('NEGATIVE: Cancel keeps the file', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('dashboard-file-delete-f1'));
    expect(screen.getByTestId('dashboard-file-confirm')).toHaveTextContent('Delete “ASSOCIATE DEGREE v2025.pdf”?');
    fireEvent.click(screen.getByTestId('dashboard-file-confirm-cancel'));
    expect(calls).toEqual([]);
  });
  it('POSITIVE: confirm deletes it', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('dashboard-file-delete-f1'));
    fireEvent.click(screen.getByTestId('dashboard-file-confirm-confirm'));
    await waitFor(() => expect(calls).toEqual(['delete']));
  });
});

describe('Help Documents: remove confirms first; .md is converted', () => {
  const setup = () => {
    const calls: string[] = [];
    server.use(
      http.get(/\/webhooks\/help\/documents$/, () => HttpResponse.json([{ _id: 'h1', fileName: 'Manual.pdf', fileSize: 2048, source: 'handbook', title: 'User Manual', status: 'loaded', uploadedAt: '2026-01-01T00:00:00Z' }])),
      http.delete(/\/webhooks\/help\/documents\/h1$/, () => { calls.push('delete'); return HttpResponse.json({ ok: true }); })
    );
    wrap(<HelpDocumentUpload />);
    return calls;
  };
  it('says Markdown and text are converted to PDF', async () => {
    setup();
    expect(await screen.findByText(/converted to PDF before loading/)).toBeInTheDocument();
  });
  it('NEGATIVE: Cancel keeps the document', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('help-doc-delete-h1'));
    expect(screen.getByTestId('help-doc-confirm')).toHaveTextContent('Remove “User Manual”?');
    fireEvent.click(screen.getByTestId('help-doc-confirm-cancel'));
    expect(calls).toEqual([]);
  });
  it('POSITIVE: confirm removes it', async () => {
    const calls = setup();
    fireEvent.click(await screen.findByTestId('help-doc-delete-h1'));
    fireEvent.click(screen.getByTestId('help-doc-confirm-confirm'));
    await waitFor(() => expect(calls).toEqual(['delete']));
  });
});
