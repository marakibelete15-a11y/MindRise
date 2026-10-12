'use strict';

// Accessible transient status message helper. SRS FR-5.x. TODO: connect localized message catalog.
export function showToast(message) {
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  return toast;
}