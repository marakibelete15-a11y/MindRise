'use strict';

// Community endpoint wrappers. SRS FR-4.x. TODO: align payloads with schemas.
import { apiRequest } from './client.js';

export const listSpaces = () => apiRequest('/community/spaces');
export const listPosts = (query = '') => apiRequest(`/community/posts${query}`);
export const createPost = (data) => apiRequest('/community/posts', { method: 'POST', body: data });
export const updatePost = (id, data) => apiRequest(`/community/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
export const deletePost = (id) => apiRequest(`/community/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const listComments = (id) => apiRequest(`/community/posts/${encodeURIComponent(id)}/comments`);
export const createComment = (id, data) => apiRequest(`/community/posts/${encodeURIComponent(id)}/comments`, { method: 'POST', body: data });
export const reactToPost = (id) => apiRequest(`/community/posts/${encodeURIComponent(id)}/reactions`, { method: 'POST', body: { kind: 'support' } });
export const removeReaction = (id) => apiRequest(`/community/posts/${encodeURIComponent(id)}/reactions`, { method: 'DELETE' });
export const reportContent = (data) => apiRequest('/community/reports', { method: 'POST', body: data });