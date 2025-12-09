import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockClient, mockWorkEntry } from '../test/test-utils';
import DashboardPage from './DashboardPage';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    getClients: vi.fn(),
    getWorkEntries: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
  });

  it('should render dashboard title', async () => {
    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render stats cards', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Clients')).toBeInTheDocument();
      expect(screen.getByText('Total Work Entries')).toBeInTheDocument();
      expect(screen.getByText('Total Hours')).toBeInTheDocument();
    });
  });

  it('should display correct client count', async () => {
    vi.mocked(apiClient.getClients).mockResolvedValue({
      clients: [mockClient, { ...mockClient, id: 2, name: 'Client 2' }],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should display correct work entries count', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [mockWorkEntry, { ...mockWorkEntry, id: 2 }, { ...mockWorkEntry, id: 3 }],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should display total hours', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [
        { ...mockWorkEntry, hours: 5 },
        { ...mockWorkEntry, id: 2, hours: 3 },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('8.00')).toBeInTheDocument();
    });
  });

  it('should display recent work entries', async () => {
    vi.mocked(apiClient.getWorkEntries).mockResolvedValue({
      workEntries: [mockWorkEntry],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Work Entries')).toBeInTheDocument();
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });
  });

  it('should display empty state when no work entries', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No work entries yet')).toBeInTheDocument();
    });
  });

  it('should render quick actions section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
    });
  });

  it('should navigate to clients page when Add Client is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add client/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/clients');
  });

  it('should navigate to work entries page when Add Work Entry is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add work entry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add work entry/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/work-entries');
  });

  it('should navigate to reports page when View Reports is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /view reports/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/reports');
  });
});
