import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// --- Mocking External Dependencies (BEFORE dynamic app import) ---

// Mock axios
vi.mock('axios');

// Mock fs (only promises part for now)
vi.mock('fs', async (importOriginal) => {
  const originalFs = await importOriginal();
  return {
    ...originalFs,
    promises: {
      unlink: vi.fn(),
    },
    existsSync: originalFs.existsSync, // Keep original existsSync if needed elsewhere
  };
});

// Mock crypto
vi.mock('crypto', async (importOriginal) => {
    const originalCrypto = await importOriginal();
    return {
        ...originalCrypto,
        randomBytes: vi.fn(),
    };
});

// Mock path fully for join
vi.mock('path');

// Mock our utility functions
vi.mock('../utils', async (importOriginal) => {
  const actualUtils = await importOriginal();
  return {
    ...actualUtils, 
    fetchTxDataAndBlockHash: vi.fn(),
    getParticipantsFromOpReturn: vi.fn(),
    generateAllCards: vi.fn(), 
    checkWinCondition: vi.fn(),
    calculateMaxMarkedInLine: vi.fn(), 
  };
});

// --- Now import the app and other dependencies ---
let app;
let gameStates;

// Import mocked functions AND the original utils object
import axios from 'axios'; 
import { promises as fsPromises } from 'fs';
import { randomBytes as cryptoRandomBytes } from 'crypto'; 
import { join as pathJoin } from 'path';
import * as utils from '../utils'; // Keep this import

describe('API Endpoints Integration Tests', () => {

    beforeEach(async () => {
        vi.clearAllMocks();

        // Set default mock implementations (excluding checkParticipantFileExists)
        axios.get.mockResolvedValue({ data: {} }); 
        fsPromises.unlink.mockResolvedValue(undefined); 
        cryptoRandomBytes.mockReturnValue(Buffer.from('test-gm-token-buffer')); 
        const mockFilePath = '/mock/path/for/unlink/check';
        pathJoin.mockReturnValue(mockFilePath); 

        // Dynamically import app and gameStates
        const serverModule = await import('../index');
        app = serverModule.app;
        gameStates = serverModule.gameStates;
        gameStates.clear(); 

        // Use spyOn AFTER dynamic import to target the correct function object
        vi.spyOn(utils, 'checkParticipantFileExists').mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks(); 
    });

    describe('POST /api/check-transaction', () => {
        it('should successfully initialize a new game (Story: Successful Initialization)', async () => {
            const mockTxId = 'valid-txid';
            const mockFilename = 'uploads/participants.csv';
            const mockBlockHash = 'mock-block-hash';
            const mockOpReturnHex = Buffer.from('mock-cid').toString('hex');
            const mockParticipants = [{ name: 'Alice' }, { name: 'Bob' }];
            const mockCards = [
                { cardId: 'card-alice', username: 'Alice', lineIndex: 0, grid: { B: [], I: [], N: [null], G: [], O: [] } },
                { cardId: 'card-bob', username: 'Bob', lineIndex: 1, grid: { B: [], I: [], N: [null], G: [], O: [] } }
            ];
            const expectedGmToken = Buffer.from('test-gm-token-buffer').toString('hex');
            const expectedUnlinkPath = '/mock/path/for/unlink/check';

            vi.mocked(utils.fetchTxDataAndBlockHash).mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
            vi.mocked(utils.getParticipantsFromOpReturn).mockResolvedValue(mockParticipants);
            vi.mocked(utils.generateAllCards).mockReturnValue(mockCards);
            pathJoin.mockReturnValue(expectedUnlinkPath); // Ensure path.join returns mocked path for unlink
            // The spyOn in beforeEach should handle checkParticipantFileExists

            const response = await request(app) 
                .post('/api/check-transaction')
                .send({ txid: mockTxId, participantFilename: mockFilename });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('gmToken', expectedGmToken);
            // ... other assertions ...

            // Assert mocks were called correctly
            expect(utils.checkParticipantFileExists).toHaveBeenCalledWith(mockFilename); // Check the spy
            expect(fsPromises.unlink).toHaveBeenCalledWith(expectedUnlinkPath); 
            expect(gameStates.has(mockTxId)).toBe(true);
        });

        // Add tests for: Game Already Exists, Missing Input, File Not Found, TX Fetch Error, IPFS Fetch Error
    });
}); 