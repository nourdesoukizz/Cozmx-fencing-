const BASE = '/api';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail?.message || data.detail || `API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function postMultipart(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  getHealth: () => request('/health'),
  getTournamentStatus: () => request('/tournament/status'),
  getEvents: () => request('/tournament/events'),
  getPools: (event) => request(`/pools${event ? `?event=${encodeURIComponent(event)}` : ''}`),
  getPoolById: (id) => request(`/pools/${id}`),
  getReferees: (event) => request(`/referees${event ? `?event=${encodeURIComponent(event)}` : ''}`),
  getRefereeById: (id) => request(`/referees/${id}`),

  // Score endpoints
  uploadPoolPhoto: (poolId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return postMultipart(`/pools/${poolId}/upload`, formData);
  },
  getSubmission: (poolId) => request(`/pools/${poolId}/submission`),
  approveScores: (poolId, scores, reviewedBy = 'Bout Committee') =>
    postJson(`/pools/${poolId}/approve`, { scores, reviewed_by: reviewedBy }),
};
