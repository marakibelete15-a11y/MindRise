'use strict';

// Moderation endpoint wrappers. SRS FR-7.x. TODO: add role-aware workflow handling.
import { apiRequest } from './client.js';

export const listReports = (query = '') => apiRequest(`/mod/reports${query}`);
export const listCrisisFlags = (query = '') => apiRequest(`/mod/crisis-flags${query}`);
export const assignReport = (id, data) => apiRequest(`/mod/reports/${encodeURIComponent(id)}/assign`, { method: 'POST', body: data });
export const assignCrisisFlag = (id, data) => apiRequest(`/mod/crisis-flags/${encodeURIComponent(id)}/assign`, { method: 'POST', body: data });
export const resolveReport = (id, data = {}) => apiRequest(`/mod/reports/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: data });
export const resolveCrisisFlag = (id, data = {}) => apiRequest(`/mod/crisis-flags/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: data });
export const getModerationLog = (query = '') => apiRequest(`/mod/log${query}`);