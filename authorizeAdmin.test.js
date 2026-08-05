import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeAdmin } from './authorizeAdmin.js';

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('allows an administrator', () => {
  let called = false;
  authorizeAdmin({ user: { is_admin: true } }, response(), () => { called = true; });
  assert.equal(called, true);
});

test('rejects a non-administrator', () => {
  const res = response();
  authorizeAdmin({ user: { is_admin: false } }, res, () => assert.fail('next called'));
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Administrator access is required.' });
});

test('rejects a token without an administrator claim', () => {
  const res = response();
  authorizeAdmin({ user: {} }, res, () => assert.fail('next called'));
  assert.equal(res.statusCode, 403);
});
