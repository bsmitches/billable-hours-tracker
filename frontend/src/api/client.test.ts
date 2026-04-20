import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiClient } from './client';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('ApiClient', () => {
  let mockAxiosInstance: ReturnType<typeof axios.create>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = axios.create();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auth endpoints', () => {
    it('should call login endpoint with email', async () => {
      const mockResponse = { data: { message: 'Login successful', user: { email: 'test@example.com' } } };
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.login('test@example.com');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/auth/login', { email: 'test@example.com' });
      expect(result).toEqual(mockResponse.data);
    });

    it('should call getCurrentUser endpoint', async () => {
      const mockResponse = { data: { user: { email: 'test@example.com' } } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getCurrentUser();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/auth/me');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Client endpoints', () => {
    it('should call getClients endpoint', async () => {
      const mockResponse = { data: { clients: [] } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getClients();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/clients');
      expect(result).toEqual(mockResponse.data);
    });

    it('should call getClient endpoint with id', async () => {
      const mockResponse = { data: { client: { id: 1, name: 'Test' } } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getClient(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/clients/1');
      expect(result).toEqual(mockResponse.data);
    });

    it('should call createClient endpoint with client data', async () => {
      const clientData = { name: 'New Client', description: 'Description' };
      const mockResponse = { data: { client: { id: 1, ...clientData } } };
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.createClient(clientData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/clients', clientData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should call updateClient endpoint with id and data', async () => {
      const updateData = { name: 'Updated Client' };
      const mockResponse = { data: { client: { id: 1, name: 'Updated Client' } } };
      vi.mocked(mockAxiosInstance.put).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.updateClient(1, updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/clients/1', updateData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should call deleteClient endpoint with id', async () => {
      const mockResponse = { data: { message: 'Client deleted' } };
      vi.mocked(mockAxiosInstance.delete).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.deleteClient(1);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/clients/1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Work entry endpoints', () => {
    it('should call getWorkEntries endpoint without clientId', async () => {
      const mockResponse = { data: { workEntries: [] } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getWorkEntries();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/work-entries', { params: {} });
      expect(result).toEqual(mockResponse.data);
    });

    it('should call getWorkEntries endpoint with clientId', async () => {
      const mockResponse = { data: { workEntries: [] } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getWorkEntries(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/work-entries', { params: { clientId: 1 } });
      expect(result).toEqual(mockResponse.data);
    });

    it('should call getWorkEntry endpoint with id', async () => {
      const mockResponse = { data: { workEntry: { id: 1 } } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getWorkEntry(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/work-entries/1');
      expect(result).toEqual(mockResponse.data);
    });

    it('should call createWorkEntry endpoint with entry data', async () => {
      const entryData = { clientId: 1, hours: 8, description: 'Work', date: '2024-01-15' };
      const mockResponse = { data: { workEntry: { id: 1, ...entryData } } };
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.createWorkEntry(entryData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/work-entries', entryData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should call updateWorkEntry endpoint with id and data', async () => {
      const updateData = { hours: 10 };
      const mockResponse = { data: { workEntry: { id: 1, hours: 10 } } };
      vi.mocked(mockAxiosInstance.put).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.updateWorkEntry(1, updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/work-entries/1', updateData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should call deleteWorkEntry endpoint with id', async () => {
      const mockResponse = { data: { message: 'Work entry deleted' } };
      vi.mocked(mockAxiosInstance.delete).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.deleteWorkEntry(1);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/work-entries/1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Report endpoints', () => {
    it('should call getClientReport endpoint with clientId', async () => {
      const mockResponse = { data: { client: {}, workEntries: [], totalHours: 0, entryCount: 0 } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getClientReport(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/reports/client/1');
      expect(result).toEqual(mockResponse.data);
    });

    it('should call exportClientReportCsv endpoint with clientId', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = { data: mockBlob };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.exportClientReportCsv(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/reports/export/csv/1', { responseType: 'blob' });
      expect(result).toEqual(mockBlob);
    });

    it('should call exportClientReportPdf endpoint with clientId', async () => {
      const mockBlob = new Blob(['pdf data'], { type: 'application/pdf' });
      const mockResponse = { data: mockBlob };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.exportClientReportPdf(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/reports/export/pdf/1', { responseType: 'blob' });
      expect(result).toEqual(mockBlob);
    });
  });

  describe('Health check', () => {
    it('should call health check endpoint', async () => {
      const mockResponse = { data: { status: 'ok' } };
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockResponse);

      const result = await apiClient.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(mockResponse.data);
    });
  });
});
