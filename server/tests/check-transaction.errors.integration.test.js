vi.mock('../utils', async () => {
  const actualUtils = await vi.importActual('../utils');
  return {
    ...actualUtils,
    fetchTxDataAndBlockHash: vi.fn(),
    getParticipantsFromOpReturn: vi.fn(),
    generateAllCards: vi.fn(),
  };
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as utils from '../utils';
import fs from 'fs';
import path from 'path';

let app;

describe('/api/check-transaction (POST) error cases', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    app = undefined;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
    vi.spyOn(path, 'basename').mockImplementation((filename) => filename.split(/[/\\]/).pop() || '');
    delete require.cache[require.resolve('../index.cjs')];
    const serverModule = require('../index.cjs');
    app = serverModule.app;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 400 if txid or participantFilename is missing', async () => {
    // No body
    let res = await request(app).post('/api/check-transaction').send({});
    expect(res.status).toBe(400);

    // Only txid
    res = await request(app).post('/api/check-transaction').send({ txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002' });
    expect(res.status).toBe(400);

    // Only participantFilename
    res = await request(app).post('/api/check-transaction').send({ participantFilename: 'uploads/sample-tickets.csv' });
    expect(res.status).toBe(400);
  });

  it('should return 500 if fetchTxDataAndBlockHash throws', async () => {
    // Clear require cache to ensure fresh mocks
    delete require.cache[require.resolve('../utils')];
    delete require.cache[require.resolve('../index.cjs')];
    const utils = require('../utils');
    // Use vi.spyOn to mock fetchTxDataAndBlockHash
    vi.spyOn(utils, 'fetchTxDataAndBlockHash').mockRejectedValue(new Error('TX fetch failed'));
    const serverModule = require('../index.cjs');
    const app = serverModule.app;
    serverModule.gameStates.clear();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
    vi.spyOn(path, 'basename').mockImplementation((filename) => filename.split(/[/\\]/).pop() || '');

    const validTxid = '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002';
    const validFilename = 'uploads/sample-tickets.csv';

    const res = await request(app)
      .post('/api/check-transaction')
      .send({ txid: validTxid, participantFilename: validFilename, gameMode: 'fullCardOnly' });

    expect(res.status).toBe(500);
    // Accept either 'error' or 'message' as the error property
    const errorMsg = res.body.error || res.body.message;
    expect(errorMsg).toMatch(/TX fetch failed/i);
    // Assert the mock was called
    expect(utils.fetchTxDataAndBlockHash).toHaveBeenCalled();
  });
}); 