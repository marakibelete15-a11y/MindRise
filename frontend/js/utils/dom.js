'use strict';

// Small DOM helpers. SRS FR-5.2. TODO: add accessibility helpers as screens are implemented.
export function createElement(tagName, attributes = {}) {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}