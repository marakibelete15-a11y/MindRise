'use strict';

// Assessment endpoint wrappers. SRS FR-2.x. TODO: align payloads with schemas.
import { apiRequest } from './client.js';

export const listAssessments = () => apiRequest('/assessments');
export const getAssessment = (id) => apiRequest(`/assessments/${encodeURIComponent(id)}`);
export const startAttempt = (id, data = {}) => apiRequest(`/assessments/${encodeURIComponent(id)}/attempts`, { method: 'POST', body: data });
export const submitAttempt = (id, data) => apiRequest(`/assessments/attempts/${encodeURIComponent(id)}/submit`, { method: 'POST', body: data });
export const getHistory = () => apiRequest('/assessments/history');
export const deleteAttempt = (id) => apiRequest(`/assessments/attempts/${encodeURIComponent(id)}`, { method: 'DELETE' });