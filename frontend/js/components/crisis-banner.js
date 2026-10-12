'use strict';

// Creates an acknowledgement-gated crisis banner. SRS FR-6.2. TODO: connect resource content and acknowledgement API.
export function createCrisisBanner(message, onAcknowledge) {
  const banner = document.createElement('section');
  banner.setAttribute('role', 'alert');
  const text = document.createElement('p');
  text.textContent = message;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Acknowledge';
  button.addEventListener('click', async () => {
    await onAcknowledge();
    banner.remove();
  });
  banner.append(text, button);
  return banner;
}