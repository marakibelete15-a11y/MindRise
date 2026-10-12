'use strict';

// Routine, goal, and progress endpoint wrappers. SRS FR-3.x. TODO: align payloads with schemas.
import { apiRequest } from './client.js';

export const listRoutines = () => apiRequest('/routines');
export const listGoals = () => apiRequest('/goals');
export const createGoal = (data) => apiRequest('/goals', { method: 'POST', body: data });
export const updateGoal = (id, data) => apiRequest(`/goals/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
export const deleteGoal = (id) => apiRequest(`/goals/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const completeGoal = (id, data = {}) => apiRequest(`/goals/${encodeURIComponent(id)}/complete`, { method: 'POST', body: data });
export const getProgress = () => apiRequest('/progress');
export const getBadges = () => apiRequest('/badges');