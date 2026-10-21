'use strict';

// Notification endpoint wrappers. SRS FR-5.x. TODO: align pagination and settings payloads.
import { apiRequest } from './client.js';

export const listNotifications = (query = '') => apiRequest(`/me/notifications${query}`);
export const markRead = (id) => apiRequest(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
export const markAllRead = () => apiRequest('/me/notifications/read-all', { method: 'POST', body: {} });