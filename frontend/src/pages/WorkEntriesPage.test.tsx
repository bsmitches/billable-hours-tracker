import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockClient, mockWorkEntry } from '../test/test-utils';
import WorkEntriesPage from './WorkEntriesPage';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    getWorkEntries: vi.fn(),
    getClients: vi.fn(),
    createWorkEntry: vi.fn(),
    updateWorkEntry: vi.fn(),
    deleteWorkEntry: vi.fn(),
  },
}));

describe('WorkEntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [mockClient] });
  });

  it('should render page title', async () => {
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Work Entries')).toBeInTheDocument();
    });
  });

  it('should render Add Work Entry button', async () => {
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(apiClient.getWorkEntries).mockImplementation(() => new Promise(() => {}));
    vi.mocked(apiClient.getClients).mockImplementation(() => new Promise(() => {}));
    render(<WorkEntriesPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display empty state when no work entries', async () => {
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/no work entries found/i)).toBeInTheDocument();
    });
  });

  it('should display message when no clients exist', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });

    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/you need to create at least one client/i)).toBeInTheDocument();
    });
  });

  it('should display work entries in table', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [mockWorkEntry],
    });

    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
      expect(screen.getByText('8 hours')).toBeInTheDocument();
    });
  });

  it('should display table headers', async () => {
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Client' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Hours' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    });
  });

  it('should open add work entry dialog when Add Work Entry button is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });
  });

  it('should close dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Add New Work Entry')).not.toBeInTheDocument();
    });
  });

  it('should show validation error when submitting without client', async () => {
    const user = userEvent.setup();
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/hours/i), '8');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Please select a client')).toBeInTheDocument();
    });
  });

  it('should not call API when submitting invalid hours', async () => {
    const user = userEvent.setup();
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const clientCombobox = dialog.querySelector('[role="combobox"]');
    if (clientCombobox) {
      await user.click(clientCombobox);
    }
    
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('option', { name: 'Test Client' }));
    
    const hoursInput = screen.getByLabelText(/hours/i);
    await user.clear(hoursInput);
    await user.type(hoursInput, '25');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(apiClient.createWorkEntry).not.toHaveBeenCalled();
  });

  it('should create work entry successfully', async () => {
    vi.mocked(apiClient.createWorkEntry).mockResolvedValue({
      workEntry: { id: 1, clientId: 1, hours: 8, date: '2024-01-15' },
    });
    const user = userEvent.setup();
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const clientCombobox = dialog.querySelector('[role="combobox"]');
    if (clientCombobox) {
      await user.click(clientCombobox);
    }
    
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('option', { name: 'Test Client' }));
    await user.type(screen.getByLabelText(/hours/i), '8');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(apiClient.createWorkEntry).toHaveBeenCalled();
    });
  });

  it('should show error alert when create fails', async () => {
    vi.mocked(apiClient.createWorkEntry).mockRejectedValue({
      response: { data: { error: 'Failed to create entry' } },
    });
    const user = userEvent.setup();
    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Work Entry')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const clientCombobox = dialog.querySelector('[role="combobox"]');
    if (clientCombobox) {
      await user.click(clientCombobox);
    }
    
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Test Client' })).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('option', { name: 'Test Client' }));
    await user.type(screen.getByLabelText(/hours/i), '8');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to create entry')).toBeInTheDocument();
    });
  });

  it('should display "No description" chip when entry has no description', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [{ ...mockWorkEntry, description: null }],
    });

    render(<WorkEntriesPage />);

    await waitFor(() => {
      expect(screen.getByText('No description')).toBeInTheDocument();
    });
  });
});
