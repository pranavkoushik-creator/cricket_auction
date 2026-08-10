const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    return `http://${host}:4000/api`;
  }
  return 'http://localhost:4000/api';
};

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Server endpoint error (${response.status}). Please verify the backend server is running and restarted.`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid non-JSON server response (${response.status}).`);
    }
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'API Request failed');
  }
  return data;
}
