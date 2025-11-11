/**
 * API Client for Web GUI
 */

class ApiClient {
  constructor() {
    this.baseURL = window.location.origin;
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      window.app?.showLogin();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.message || error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(username, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  logout() {
    this.clearToken();
  }

  // Data
  async queryData(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/data?${query}`);
  }

  async getDataSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/data/summary?${query}`);
  }

  async exportData(format, params = {}) {
    const query = new URLSearchParams({ ...params, format }).toString();
    const response = await fetch(`${this.baseURL}/api/data/export?${query}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${Date.now()}.${format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Schemas
  async listSchemas() {
    return this.request('/api/schemas');
  }

  async getSchema(name) {
    return this.request(`/api/schemas/${name}`);
  }

  // Stats
  async getStats() {
    return this.request('/api/stats');
  }

  async getBuffer() {
    return this.request('/api/buffer');
  }

  async getMetrics() {
    return this.request('/api/metrics');
  }

  async getWebSocketClients() {
    return this.request('/api/websocket/clients');
  }

  // Health
  async getHealth() {
    return this.request('/health');
  }

  async getDetailedHealth() {
    return this.request('/health/detailed');
  }

  // Admin
  async listUsers() {
    return this.request('/api/admin/users');
  }

  async createUser(username, password, role = 'user') {
    return this.request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  }

  async deleteUser(username) {
    return this.request(`/api/admin/users/${username}`, {
      method: 'DELETE',
    });
  }

  async getRetentionStatus() {
    return this.request('/api/admin/retention');
  }

  async executeRetention() {
    return this.request('/api/admin/retention/execute', {
      method: 'POST',
    });
  }

  async cleanup(before) {
    return this.request('/api/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify({ before }),
    });
  }

  isAuthenticated() {
    return !!this.token;
  }
}

window.api = new ApiClient();
