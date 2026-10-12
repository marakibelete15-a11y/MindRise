'use strict';

// JSON API client with bearer auth and normalized errors. SRS API conventions, FR-1.x through FR-7.x. TODO: add refresh/session policy.
import { getValue, removeValue } from '../utils/storage.js';

const API_BASE_URL = '/api';

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getValue('accessToken');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') body = JSON.stringify(body);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    removeValue('accessToken');
    globalThis.dispatchEvent(new Event('mindrise:unauthorized'));
  }
  if (!response.ok) {
    const error = payload.error || {};
    throw { code: error.code || 'REQUEST_ERROR', message: error.message || 'The request could not be completed.', status: response.status };
  }
  return payload;
}