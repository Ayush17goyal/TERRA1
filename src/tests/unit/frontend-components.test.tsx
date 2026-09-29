import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { UploadCenter } from '../../features/documents/uploads/UploadCenter';
import { BareActAdminDashboardPage } from '../../features/admin';
import { renderWithQuery } from '../helpers/render';

describe('Frontend components and accessibility', () => {
  it('supports document upload and retry interactions', async () => {
    const onUpload = vi.fn();
    const onRetry = vi.fn();
    render(<UploadCenter onUpload={onUpload} onRetry={onRetry} jobs={[{ id: 'job-1', file: new File(['x'], 'Act.pdf', { type: 'application/pdf' }), fileName: 'Act.pdf', mimeType: 'application/pdf', sizeBytes: 1200, progress: 44, status: 'failed', error: 'network' }]} />);
    await userEvent.click(screen.getByRole('button', { name: /retry upload/i }));
    expect(onRetry).toHaveBeenCalledWith('job-1');
    expect(screen.getByText(/network/i)).toBeDefined();
  });

  it('renders the RBAC protected admin dashboard for authorized administrators', async () => {
    renderWithQuery(<BareActAdminDashboardPage />);
    expect(await screen.findByText('Mentor Admin')).toBeInTheDocument();
    expect(await screen.findByText('Total students')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /students/i })).toBeInTheDocument();
  });

  it('has no critical axe violations in the upload center', async () => {
    const { container } = render(<UploadCenter onUpload={vi.fn()} onRetry={vi.fn()} jobs={[]} />);
    const result = await axe.run(container);
    expect(result.violations.filter((violation) => violation.impact === 'critical')).toHaveLength(0);
  });
});

