import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import request from 'supertest';

let app;
beforeAll(() => {
  vi.resetModules();
  app = require('./index.js');
});

afterAll(() => {
  vi.resetAllMocks();
});

describe('GET /api/block-hash/:blockNumber (mocked)', () => {
  it('should return 400 for invalid block number', async () => {
    const res = await request(app).get('/api/block-hash/notanumber');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 if block not found', async () => {
    vi.mocked(axios).get.mockRejectedValueOnce({ response: { status: 404 } });
    const res = await request(app).get('/api/block-hash/10000100');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
}); 