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

async function authRequest(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function authPostJson(path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail?.message || data.detail || `API ${res.status}: ${res.statusText}`);
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

  // Event control endpoints
  startEvent: (eventName) => postJson(`/tournament/events/${encodeURIComponent(eventName)}/start`, {}),
  stopEvent: (eventName) => postJson(`/tournament/events/${encodeURIComponent(eventName)}/stop`, {}),
  pingReferees: (eventName) => postJson(`/tournament/events/${encodeURIComponent(eventName)}/ping-referees`, {}),
  pingReferee: (refereeId, messageType, customMessage = '') =>
    postJson(`/referees/${refereeId}/ping`, { message_type: messageType, custom_message: customMessage }),
  batchPingReferees: (refereeIds, messageType, customMessage = '') =>
    postJson('/referees/batch-ping', { referee_ids: refereeIds, message_type: messageType, custom_message: customMessage }),
  getTelegramLink: (refereeId) => request(`/referees/${refereeId}/telegram-link`),
  getRefereeByToken: (token) => request(`/referee/${token}`),

  // Score endpoints
  uploadPoolPhoto: (poolId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return postMultipart(`/pools/${poolId}/upload`, formData);
  },
  getSubmission: (poolId) => request(`/pools/${poolId}/submission`),
  approveScores: (poolId, scores, reviewedBy = 'Bout Committee') =>
    postJson(`/pools/${poolId}/approve`, { scores, reviewed_by: reviewedBy }),

  // Coach endpoints
  coachAuth: (code) => postJson('/coach/auth', { code }),
  getCoachFencers: (token, event, club) => {
    let path = '/coach/fencers';
    const params = [];
    if (event) params.push(`event=${encodeURIComponent(event)}`);
    if (club) params.push(`club=${encodeURIComponent(club)}`);
    if (params.length) path += `?${params.join('&')}`;
    return authRequest(path, token);
  },
  getCoachFencer: (token, id) => authRequest(`/coach/fencers/${id}`, token),
  getCoachFencerInsight: (token, id) => authRequest(`/coach/fencers/${id}/insight`, token),

  // New BT engine endpoints
  getCoachState: (token) => authRequest('/coach/state', token),
  getCoachTrajectory: (token, fencer) => {
    let path = '/coach/trajectory';
    if (fencer) path += `?fencer=${encodeURIComponent(fencer)}`;
    return authRequest(path, token);
  },
  getCoachPairwise: (token, a, b) =>
    authRequest(`/coach/pairwise?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`, token),
  addCoachBout: (token, boutData) =>
    authPostJson('/coach/bout', token, boutData),
  setCoachBracket: (token, seedings) =>
    authPostJson('/coach/bracket', token, { seedings }),
  getCoachSimulate: (token, nSims) =>
    authRequest(`/coach/simulate${nSims ? `?n_sims=${nSims}` : ''}`, token),
  getCoachBouts: (token) => authRequest('/coach/bouts', token),
  getCoachFencerNames: (token) => authRequest('/coach/fencer-names', token),

  // Agent endpoints
  getAgentStatus: () => request('/agent/status'),
  getAgentLog: (limit = 50, offset = 0) => request(`/agent/log?limit=${limit}&offset=${offset}`),
  getAgentPending: () => request('/agent/pending'),
  enableAgent: () => postJson('/agent/enable', {}),
  disableAgent: () => postJson('/agent/disable', {}),
  updateAgentConfig: (config) => postJson('/agent/config', config),

  // Announcer endpoints
  getAnnouncements: (limit = 50, offset = 0) => request(`/announcer/list?limit=${limit}&offset=${offset}`),
  polishAnnouncement: (text) => postJson('/announcer/polish', { text }),
  markAnnounced: (id) => postJson('/announcer/mark-announced', { id }),
  dismissAnnouncement: (id) => postJson('/announcer/dismiss', { id }),
};
