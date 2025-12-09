import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Layout from './Layout';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard' }),
  };
});

describe('Layout', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { email: 'test@example.com', createdAt: '2024-01-01' },
      login: vi.fn(),
      logout: mockLogout,
      isLoading: false,
      isAuthenticated: true,
    });
  });

  it('should render children content', () => {
    render(
      <Layout>
        <div data-testid="child-content">Test Content</div>
      </Layout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render app title in sidebar', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const timeTrackerElements = screen.getAllByText('Time Tracker');
    expect(timeTrackerElements.length).toBeGreaterThan(0);
  });

  it('should render navigation menu items', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const dashboardElements = screen.getAllByText('Dashboard');
    expect(dashboardElements.length).toBeGreaterThan(0);
    const clientsElements = screen.getAllByText('Clients');
    expect(clientsElements.length).toBeGreaterThan(0);
    const workEntriesElements = screen.getAllByText('Work Entries');
    expect(workEntriesElements.length).toBeGreaterThan(0);
    const reportsElements = screen.getAllByText('Reports');
    expect(reportsElements.length).toBeGreaterThan(0);
  });

  it('should display user email', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should display user avatar with first letter of email', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should render logout button', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('should call logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should navigate to dashboard when Dashboard menu item is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const dashboardItems = screen.getAllByText('Dashboard');
    const menuItem = dashboardItems.find(el => el.closest('[role="button"]'));
    if (menuItem) {
      await user.click(menuItem);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should navigate to clients when Clients menu item is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const clientsItems = screen.getAllByText('Clients');
    const menuItem = clientsItems.find(el => el.closest('[role="button"]'));
    if (menuItem) {
      await user.click(menuItem);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/clients');
  });

  it('should navigate to work entries when Work Entries menu item is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const workEntriesItems = screen.getAllByText('Work Entries');
    const menuItem = workEntriesItems.find(el => el.closest('[role="button"]'));
    if (menuItem) {
      await user.click(menuItem);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/work-entries');
  });

  it('should navigate to reports when Reports menu item is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const reportsItems = screen.getAllByText('Reports');
    const menuItem = reportsItems.find(el => el.closest('[role="button"]'));
    if (menuItem) {
      await user.click(menuItem);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/reports');
  });

  it('should highlight current page in navigation', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const dashboardItems = screen.getAllByText('Dashboard');
    const menuItem = dashboardItems.find(el => el.closest('[role="button"]'));
    expect(menuItem?.closest('[role="button"]')).toHaveClass('Mui-selected');
  });
});
