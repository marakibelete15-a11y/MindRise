'use strict';

// Current-account endpoint wrappers. SRS FR-1.3, FR-1.7, FR-5.2, 5.4. TODO: align payloads with schemas.
import { apiRequest } from './client.js';

export const getMe = () => apiRequest('/me');
export const updateProfile = (data) => apiRequest('/me/profile', { method: 'PATCH', body: data });
export const uploadAvatar = (formData) => apiRequest('/me/avatar', { method: 'POST', body: formData });
export const getSettings = () => apiRequest('/me/settings');
export const updateSettings = (data) => apiRequest('/me/settings', { method: 'PATCH', body: data });
export const deleteMe = () => apiRequest('/me', { method: 'DELETE' });