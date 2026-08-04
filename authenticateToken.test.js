import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { authenticateToken } from './authenticateToken.js';

const secret = 'test-secret-that-is-long-enough-for-tests';

const invoke = (authorization, configuredSecret = secret) => {
  if (configuredSecret === null) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = configuredSecret;
  }

  const req = {
    get: (header) => header === 'authorization' ? authorization : undefined,
  };
  const response = { statusCode: 200, body: undefined };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
  };
  let nextCalled = false;

  authenticateToken(req, res, () => {
    nextCalled = true;
  });

  return { req, response, nextCalled };
};

test.after(() => {
  delete process.env.JWT_SECRET;
});

test('rejects a missing Authorization header with 401', () => {
  const result = invoke(undefined);
  assert.equal(result.response.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('rejects a malformed Bearer header with 401', () => {
  const result = invoke('Basic credentials');
  assert.equal(result.response.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('accepts a valid token and attaches its payload to the request', () => {
  const token = jwt.sign({ id: 42, email: 'user@example.com' }, secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  const result = invoke(`Bearer ${token}`);

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.id, 42);
  assert.equal(result.req.user.email, 'user@example.com');
});

test('rejects an invalid token with 403', () => {
  const token = jwt.sign({ id: 42 }, 'different-secret', { algorithm: 'HS256' });
  const result = invoke(`Bearer ${token}`);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: 'Invalid token.' });
});

test('rejects an expired token with 403', () => {
  const token = jwt.sign({ id: 42 }, secret, {
    algorithm: 'HS256',
    expiresIn: -1,
  });
  const result = invoke(`Bearer ${token}`);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: 'Token expired.' });
});

test('reports a missing server secret as a configuration error', () => {
  const result = invoke('Bearer token', null);
  assert.equal(result.response.statusCode, 500);
  assert.deepEqual(result.response.body, {
    error: 'Authentication service is not configured.',
  });
});
