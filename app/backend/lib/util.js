// KODA — crypto/id/jwt utilities (node:crypto only, zero dependencies)
'use strict';
const crypto = require('node:crypto');

const SECRET = process.env.KODA_JWT_SECRET || 'koda-dev-secret-change-in-production';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x')}`;
}

function token(bytes = 24) { return crypto.randomBytes(bytes).toString('base64url'); }

// password hashing — scrypt
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// minimal JWT (HS256)
function signJwt(payload, ttlSec = 60 * 60 * 24 * 7) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
function verifyJwt(jwt) {
  try {
    const [h, b, s] = String(jwt).split('.');
    const expect = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function hmac(secret, s) { return crypto.createHmac('sha256', secret).update(s).digest('hex'); }

module.exports = { id, token, hashPassword, verifyPassword, signJwt, verifyJwt, sha256, hmac };
