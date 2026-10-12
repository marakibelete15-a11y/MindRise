'use strict';

// Help and crisis resource endpoint wrappers. SRS FR-5.1, FR-5.3, FR-6.x. TODO: add offline fallback strategy.
import { apiRequest } from './client.js';

export const listResources = () => apiRequest('/resources');
export const getActiveCrisis = () => apiRequest('/crisis/active');
export const acknowledgeCrisis = (data = {}) => apiRequest('/crisis/acknowledge', { method: 'POST', body: data });