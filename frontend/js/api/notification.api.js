'use strict';

// Notification endpoint wrappers. SRS FR-5.x. TODO: align pagination and settings payloads.
import { apiRequest } from './client.js';

export const listNotifications = (query = '') => apiRequest(`/notifications${query}`);
export const markRead = (id) => apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
export const markAllRead = () => apiRequest('/notifications/read-all', { method: 'POST', body: {} });