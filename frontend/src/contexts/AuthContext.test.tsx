import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });

  describe('AuthProvider', () => {
    it('should initialize with no user and loading state', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should check auth on mount when email is stored', async () => {
      mockLocalStorage.getItem.mockReturnValue('test@example.com');
      vi.mocked(apiClient.getCurrentUser).mockResolvedValueOnce({
        user: { email: 'test@example.com', createdAt: '2024-01-01' },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiClient.getCurrentUser).toHaveBeenCalled();
      expect(result.current.user).toEqual({ email: 'test@example.com', createdAt: '2024-01-01' });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear stored email when auth check fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('test@example.com');
      vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce(new Error('Auth failed'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userEmail');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should login successfully', async () => {
      vi.mocked(apiClient.login).mockResolvedValueOnce({
        user: { email: 'test@example.com', createdAt: '2024-01-01' },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com');
      });

      expect(apiClient.login).toHaveBeenCalledWith('test@example.com');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userEmail', 'test@example.com');
      expect(result.current.user).toEqual({ email: 'test@example.com', createdAt: '2024-01-01' });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should throw error when login fails', async () => {
      const loginError = new Error('Login failed');
      vi.mocked(apiClient.login).mockRejectedValueOnce(loginError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com');
        })
      ).rejects.toThrow('Login failed');

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should logout successfully', async () => {
      mockLocalStorage.getItem.mockReturnValue('test@example.com');
      vi.mocked(apiClient.getCurrentUser).mockResolvedValueOnce({
        user: { email: 'test@example.com', createdAt: '2024-01-01' },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.logout();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userEmail');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
