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

describe('GET /api/block-hash/:blockNumber', () => {
  it('should return block hash for a valid block number (real network)', async () => {
    // This test uses a real BlockCypher call
    const blockNumber = 888952;
    const blockHash = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';
    const res = await request(app).get(`/api/block-hash/${blockNumber}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'success',
      blockNumber,
      blockHash
    });
  });
}); 