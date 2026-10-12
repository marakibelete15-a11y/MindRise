'use strict';

// Authentication endpoint wrappers. SRS FR-1.1, FR-1.2, FR-1.8. TODO: align payloads with approved schemas.
import { apiRequest } from './client.js';

export const register = (data) => apiRequest('/auth/register', { method: 'POST', body: data });
export const verify = (data) => apiRequest('/auth/verify', { method: 'POST', body: data });
export const resendCode = (data) => apiRequest('/auth/resend-code', { method: 'POST', body: data });
export const login = (data) => apiRequest('/auth/login', { method: 'POST', body: data });
export const requestRecovery = (data) => apiRequest('/auth/recover/request', { method: 'POST', body: data });
export const confirmRecovery = (data) => apiRequest('/auth/recover/confirm', { method: 'POST', body: data });