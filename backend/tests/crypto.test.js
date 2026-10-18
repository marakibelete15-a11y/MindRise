'use strict';

process.env.NODE_ENV = 'test';

// Cryptography unit and security tests. SRS 5.4.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { encrypt, decrypt, encryptJson, decryptJson } = require('../src/utils/crypto');

test('crypto: round trip successfully encrypts and decrypts text', () => {
  const plaintext = 'MindRise confidential test data: 12345';
  const ciphertext = encrypt(plaintext);

  assert.equal(typeof ciphertext, 'string');
  assert.equal(ciphertext.startsWith('v1:'), true);

  const decrypted = decrypt(ciphertext);
  assert.equal(decrypted, plaintext);
});

test('crypto: same plaintext produces different ciphertexts due to random IV', () => {
  const plaintext = 'Consistent input text';
  const ciphertext1 = encrypt(plaintext);
  const ciphertext2 = encrypt(plaintext);

  assert.notEqual(ciphertext1, ciphertext2);
  assert.equal(decrypt(ciphertext1), plaintext);
  assert.equal(decrypt(ciphertext2), plaintext);
});

test('crypto: tampered ciphertext throws authentication error', () => {
  const plaintext = 'Secret clinical notes';
  const ciphertext = encrypt(plaintext);
  const parts = ciphertext.split(':');

  // Tamper with the ciphertext component (part 3)
  const ctBuf = Buffer.from(parts[3], 'base64');
  ctBuf[0] = ctBuf[0] ^ 0xff; // flip bits
  parts[3] = ctBuf.toString('base64');
  const tampered = parts.join(':');

  assert.throws(
    () => decrypt(tampered),
    /Decryption failed/
  );
});

test('crypto: tampered auth tag throws authentication error', () => {
  const plaintext = 'Secret clinical notes';
  const ciphertext = encrypt(plaintext);
  const parts = ciphertext.split(':');

  // Tamper with auth tag (part 2)
  const tagBuf = Buffer.from(parts[2], 'base64');
  tagBuf[0] = tagBuf[0] ^ 0xff;
  parts[2] = tagBuf.toString('base64');
  const tampered = parts.join(':');

  assert.throws(
    () => decrypt(tampered),
    /Decryption failed/
  );
});

test('crypto: decryption with wrong key fails and throws', () => {
  const plaintext = 'Secret data with key A';
  const wrongKey = crypto.randomBytes(32).toString('base64');
  const ciphertext = encrypt(plaintext);

  assert.throws(
    () => decrypt(ciphertext, wrongKey),
    /Decryption failed/
  );
});

test('crypto: invalid payload format throws', () => {
  assert.throws(() => decrypt('not-a-valid-payload'), /Invalid ciphertext format/);
  assert.throws(() => decrypt('v2:abc:def:ghi'), /Invalid ciphertext format/);
});

test('crypto: encryptJson and decryptJson handle complex objects', () => {
  const assessmentData = {
    assessmentId: '10000000-0000-4000-8000-000000000001',
    answers: [
      { questionId: 'q1', score: 2, note: 'feeling low' },
      { questionId: 'q2', score: 0, note: 'supported' },
    ],
    metadata: { timestamp: 1729200000000 },
  };

  const encrypted = encryptJson(assessmentData);
  assert.equal(encrypted.startsWith('v1:'), true);

  const decrypted = decryptJson(encrypted);
  assert.deepEqual(decrypted, assessmentData);
});

test('crypto: errors and payloads never expose plaintext in error messages', () => {
  const sensitiveText = 'SUPER_SENSITIVE_PII_TEXT_12345';
  const ciphertext = encrypt(sensitiveText);
  const tampered = ciphertext.slice(0, -4) + 'AAAA';

  try {
    decrypt(tampered);
    assert.fail('Expected decrypt to throw');
  } catch (error) {
    assert.equal(error.message.includes(sensitiveText), false);
  }
});
