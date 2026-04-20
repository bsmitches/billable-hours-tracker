import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockClient, mockClientReport } from '../test/test-utils';
import ReportsPage from './ReportsPage';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getClientReport: vi.fn(),
    exportClientReportCsv: vi.fn(),
    exportClientReportPdf: vi.fn(),
  },
}));

global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = vi.fn();

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [mockClient] });
    vi.mocked(apiClient.getClientReport).mockResolvedValue(mockClientReport);
  });

  it('should render page title', async () => {
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(apiClient.getClients).mockImplementation(() => new Promise(() => {}));
    render(<ReportsPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display message when no clients exist', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText(/you need to create at least one client/i)).toBeInTheDocument();
    });
  });

  it('should display client selector', async () => {
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('should display message to select a client initially', async () => {
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText(/select a client to view their time report/i)).toBeInTheDocument();
    });
  });

  it('should load report when client is selected', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(apiClient.getClientReport).toHaveBeenCalledWith(1);
    });
  });

  it('should display report metrics when client is selected', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByText('Total Hours')).toBeInTheDocument();
      expect(screen.getByText('Total Entries')).toBeInTheDocument();
      expect(screen.getByText('Average Hours per Entry')).toBeInTheDocument();
    });
  });

  it('should display work entries table when client is selected', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Hours' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Created' })).toBeInTheDocument();
    });
  });

  it('should display empty state when client has no work entries', async () => {
    vi.mocked(apiClient.getClientReport).mockResolvedValue({
      ...mockClientReport,
      workEntries: [],
      totalHours: 0,
      entryCount: 0,
    });
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByText(/no work entries found for this client/i)).toBeInTheDocument();
    });
  });

  it('should have disabled export buttons when no client is selected', async () => {
    render(<ReportsPage />);

    await waitFor(() => {
      const csvButton = screen.getByRole('button', { name: /export as csv/i });
      const pdfButton = screen.getByRole('button', { name: /export as pdf/i });
      expect(csvButton).toBeDisabled();
      expect(pdfButton).toBeDisabled();
    });
  });

  it('should enable export buttons when client is selected', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      const csvButton = screen.getByRole('button', { name: /export as csv/i });
      const pdfButton = screen.getByRole('button', { name: /export as pdf/i });
      expect(csvButton).toBeEnabled();
      expect(pdfButton).toBeEnabled();
    });
  });

  it('should export CSV when CSV button is clicked', async () => {
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
    vi.mocked(apiClient.exportClientReportCsv).mockResolvedValue(mockBlob);
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export as csv/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /export as csv/i }));

    await waitFor(() => {
      expect(apiClient.exportClientReportCsv).toHaveBeenCalledWith(1);
    });
  });

  it('should export PDF when PDF button is clicked', async () => {
    const mockBlob = new Blob(['pdf data'], { type: 'application/pdf' });
    vi.mocked(apiClient.exportClientReportPdf).mockResolvedValue(mockBlob);
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export as pdf/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /export as pdf/i }));

    await waitFor(() => {
      expect(apiClient.exportClientReportPdf).toHaveBeenCalledWith(1);
    });
  });

  it('should show error when CSV export fails', async () => {
    vi.mocked(apiClient.exportClientReportCsv).mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export as csv/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /export as csv/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to export csv report/i)).toBeInTheDocument();
    });
  });

  it('should show error when PDF export fails', async () => {
    vi.mocked(apiClient.exportClientReportPdf).mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: 'Test Client' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export as pdf/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /export as pdf/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to export pdf report/i)).toBeInTheDocument();
    });
  });
});
