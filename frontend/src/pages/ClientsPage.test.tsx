import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockClient } from '../test/test-utils';
import ClientsPage from './ClientsPage';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
  },
}));

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
  });

  it('should render page title', async () => {
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });
  });

  it('should render Add Client button', async () => {
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(apiClient.getClients).mockImplementation(() => new Promise(() => {}));
    render(<ClientsPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display empty state when no clients', async () => {
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
    });
  });

  it('should display clients in table', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [mockClient],
    });

    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });
  });

  it('should display table headers', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [mockClient],
    });

    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('should open add client dialog when Add Client button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
      expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });
  });

  it('should close dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Add New Client')).not.toBeInTheDocument();
    });
  });

  it('should not call API when submitting empty name', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(apiClient.createClient).not.toHaveBeenCalled();
  });

  it('should create client successfully', async () => {
    vi.mocked(apiClient.createClient).mockResolvedValue({
      client: { id: 1, name: 'New Client', description: 'New Description' },
    });
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/client name/i), 'New Client');
    await user.type(screen.getByLabelText(/description/i), 'New Description');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(apiClient.createClient).toHaveBeenCalledWith({
        name: 'New Client',
        description: 'New Description',
      });
    });
  });

  it('should open edit dialog with client data', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [mockClient],
    });
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: '' });
    const editButton = editButtons.find(btn => btn.querySelector('[data-testid="EditIcon"]'));
    if (editButton) {
      await user.click(editButton);
    }

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Edit Client')).toBeInTheDocument();
    });
  });

  it('should show error alert when create fails', async () => {
    vi.mocked(apiClient.createClient).mockRejectedValue({
      response: { data: { error: 'Client already exists' } },
    });
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    await waitFor(() => {
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/client name/i), 'Existing Client');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Client already exists')).toBeInTheDocument();
    });
  });

  it('should display "No description" chip when client has no description', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [{ ...mockClient, description: null }],
    });

    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('No description')).toBeInTheDocument();
    });
  });
});
