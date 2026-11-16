import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';

const SECRET_FILE = path.resolve(process.cwd(), 'data', '.session_secret');

function getAuthSecret(): string {
  if (process.env.ADMIN_AUTH_SECRET && process.env.ADMIN_AUTH_SECRET.length >= 16) {
    return process.env.ADMIN_AUTH_SECRET;
  }
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

export const SESSION_COOKIE_NAME = 'raghan_admin_session';

export interface AdminSessionPayload {
  userId: number;
  email: string;
  name: string;
  role: string;
  exp: number;
}

export function signAdminToken(payload: Omit<AdminSessionPayload, 'exp'>): string {
  const fullPayload: AdminSessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyAdminToken(token: string): AdminSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(encoded)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminSessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

export interface AdminRequest extends Request {
  adminUser?: AdminSessionPayload;
}

export function extractAdminFromRequest(req: Request): AdminSessionPayload | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    const verified = verifyAdminToken(cookieToken);
    if (verified) return verified;
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const verified = verifyAdminToken(token);
    if (verified) return verified;
  }
  return null;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const admin = extractAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ error: 'Authentication required. Please sign in as clinic staff.' });
    return;
  }
  req.adminUser = admin;
  next();
}
