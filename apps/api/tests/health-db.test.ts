import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /health/db', () => {
  it('runs a real query against TEST_DATABASE_URL and returns 200', async () => {
    const app = createApp();
    const res = await request(app).get('/health/db');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
