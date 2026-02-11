const BASE = '/api';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
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
};
