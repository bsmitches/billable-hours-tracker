/* eslint-disable react-refresh/only-export-components */
import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

interface WrapperProps {
  children: ReactNode;
}

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

export const AllTheProviders = ({ children }: WrapperProps) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <BrowserRouter>{children}</BrowserRouter>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

export const mockClient = {
  id: 1,
  name: 'Test Client',
  description: 'Test Description',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

export const mockWorkEntry = {
  id: 1,
  client_id: 1,
  hours: 8,
  description: 'Test work entry',
  date: '2024-01-15',
  created_at: '2024-01-15T00:00:00.000Z',
  updated_at: '2024-01-15T00:00:00.000Z',
  client_name: 'Test Client',
};

export const mockUser = {
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const mockClientReport = {
  client: mockClient,
  workEntries: [mockWorkEntry],
  totalHours: 8,
  entryCount: 1,
};
