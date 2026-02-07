// workoutEngine.js
// Provides a simple RepCounter and session syncing helpers to the backend.

import getApiBase from "./apiBase";

export class RepCounter {
  constructor({ upThreshold = 150, downThreshold = 110, onRep }) {
    this.upThreshold = upThreshold; // angle considered standing
    this.downThreshold = downThreshold; // angle considered bottom
    this.onRep = onRep; // callback when a rep completes
    this.state = 'up';
    this.count = 0;
  }

  // Call with the primary angle (e.g., knee angle for squats)
  update(angle) {
    if (this.state === 'up') {
      if (angle <= this.downThreshold) {
        this.state = 'down';
      }
    } else if (this.state === 'down') {
      if (angle >= this.upThreshold) {
        this.state = 'up';
        this.count += 1;
        if (this.onRep) this.onRep(this.count);
      }
    }
  }

  reset() {
    this.state = 'up';
    this.count = 0;
  }
}

// Backend session helpers
const API_BASE = getApiBase();

const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function startSession(exercise) {
  const res = await fetch(`${API_BASE}/api/workout/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ exercise }),
  });
  if (!res.ok) throw new Error('Failed to start session');
  return res.json(); // returns workout doc with sessionId
}

export async function updateSession(sessionId, updates) {
  const res = await fetch(`${API_BASE}/api/workout/session/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update session');
  return res.json();
}

export async function completeSession(sessionId, finalData = {}) {
  const res = await fetch(`${API_BASE}/api/workout/session/${sessionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(finalData),
  });
  if (!res.ok) throw new Error('Failed to complete session');
  return res.json();
}
