import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import * as utils from '../utils';
const { app, gameStates: testGameStates, handleDraw } = require('../index.cjs');

vi.mock('../utils', async () => {
  const actualUtils = await vi.importActual('../utils');
  return {
    ...actualUtils,
    derivePublicKey: vi.fn(),
    checkLineWin: vi.fn(),
    checkFullCardWin: vi.fn(),
  };
});

// --- Test Suite Setup ---
let server; // Variable to hold the server instance

describe('POST /api/draw/:txid', () => {
    const testTxid = 'test-txid-for-draw-123';
    const baseSeed = '0000000000000000000deadbeef112233445566778899aabbccddeeff00'; // Valid hex seed
    const mockGmToken = 'test-gm-token-12345';
    const expectedDrawnNumber = 42;

    beforeAll(async () => {
        server = app.listen(0); // Start server on random port
        console.log(`[Test Server - api.draw.test.js] Started on port ${server.address().port}`);
    });

    afterAll(async () => {
        await new Promise(resolve => server.close(resolve)); // Close server
        console.log(`[Test Server - api.draw.test.js] Closed.`);
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        testGameStates.clear();

        testGameStates.set(testTxid, {
            txid: testTxid,
            status: 'initialized',
            blockHash: 'draw-test-block-hash',
            participants: [{ name: 'Alice', ticket: '1' }],
            baseSeed: baseSeed,
            drawnNumbers: [],
            drawSequence: [],
            nextDerivationIndex: 0,
            gmToken: mockGmToken,
            lastDrawTime: null,
            creationTime: Date.now(),
            isOver: false,
            gameMode: 'fullCardOnly',
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null,
            continueAfterPartialWin: false,
            winners: [],
            cards: [{ cardId: 'card-alice', username: 'Alice', grid: { B: [], I: [], N: [null], G: [], O: [] } }]
        });

        vi.mocked(utils.derivePublicKey).mockReturnValue(Buffer.from('mock-pub-key'));
        vi.mocked(utils.checkLineWin).mockReturnValue(null);
        vi.mocked(utils.checkFullCardWin).mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        testGameStates.clear();
    });

    it('Story: Successful Draw (No Win)', async () => {
        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(200);
        // Assert that a number was drawn
        expect(typeof response.body.drawnNumber).toBe('number');
        expect(response.body.isOver).toBe(false);
        expect(response.body.gameMode).toBe('fullCardOnly');
        expect(response.body.partialWinOccurred).toBe(false);
        expect(response.body.partialWinners).toBeNull();
        expect(response.body.fullCardWinners).toBeNull();
        expect(response.body.message).toBe('Number drawn successfully!');
        expect(typeof response.body.totalDrawn).toBe('number');
        expect(typeof response.body.nextDerivationIndex).toBe('number');

        // Check that the state was updated
        const updatedState = testGameStates.get(testTxid);
        expect(updatedState).toBeDefined();
        expect(updatedState.drawnNumbers.length).toBe(1);
        expect(updatedState.nextDerivationIndex).toBe(1);
        expect(updatedState.isOver).toBe(false);
        expect(updatedState.partialWinners).toBeNull();
        expect(updatedState.fullCardWinners).toBeNull();
    });

    it('should return 404 if game txid does not exist', async () => {
        const nonExistentTxid = 'non-existent-txid';
        const response = await request(server)
            .post(`/api/draw/${nonExistentTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ message: 'Game not found or not initialized.' });
    });

    it('should return 400 if game is already over', async () => {
        // Set up a finished game state
        testGameStates.set(testTxid, {
            ...testGameStates.get(testTxid),
            isOver: true,
            winners: ['Alice'],
            drawnNumbers: [1, 2, 3],
        });

        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(400);
        expect(response.body).toEqual(expect.objectContaining({
            message: expect.stringContaining('Game is already over'),
            winners: ['Alice'],
            drawnNumbers: [1, 2, 3],
            totalDrawn: 3
        }));
    });

    it('should return 400 if all numbers are already drawn', async () => {
        // Set up a game state with 75 numbers drawn
        testGameStates.set(testTxid, {
            ...testGameStates.get(testTxid),
            drawnNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
            nextDerivationIndex: 75,
            isOver: false,
        });

        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'All 75 numbers have been drawn.' });
    });

    it('should handle uniqueness constraint (require multiple derivations)', () => {
        // Use real, static data from @start-story.mdc
        const testTxid = '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002';
        const baseSeed = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';
        const mockGmToken = 'gm-token-mock';
        const alreadyDrawn = 12; // B:12
        const uniqueNumber = 25; // I:25
        let callCount = 0;

        // Set up a minimal game state
        testGameStates.clear();
        testGameStates.set(testTxid, {
            txid: testTxid,
            status: 'initialized',
            blockHash: baseSeed,
            participants: [{ name: 'Alice', ticket: '1' }],
            baseSeed: baseSeed,
            drawnNumbers: [alreadyDrawn],
            drawSequence: [],
            nextDerivationIndex: 0,
            gmToken: mockGmToken,
            lastDrawTime: null,
            creationTime: Date.now(),
            isOver: false,
            gameMode: 'fullCardOnly',
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null,
            continueAfterPartialWin: false,
            winners: [],
            cards: [{ cardId: 'card-alice', username: 'Alice', grid: { B: [], I: [], N: [null], G: [], O: [] } }]
        });

        // Create a local mock utils object
        const mockUtils = {
            derivePublicKey: (_seed, idx) => Buffer.from(`pubkey-${idx}`),
            hashPublicKeyToNumber: () => {
                callCount++;
                console.log('[MOCK] hashPublicKeyToNumber called, callCount:', callCount);
                return callCount === 1 ? alreadyDrawn : uniqueNumber;
            },
            checkLineWin: () => null,
            checkFullCardWin: () => false
        };

        // Mock req/res
        const req = {
            params: { txid: testTxid },
            headers: { authorization: `Bearer ${mockGmToken}` }
        };
        let statusCode, jsonBody;
        const res = {
            status(code) { statusCode = code; return this; },
            json(body) { jsonBody = body; return this; }
        };

        handleDraw(req, res, mockUtils);

        expect(statusCode).toBe(200);
        expect(jsonBody.drawnNumber).toBe(uniqueNumber);
        expect(jsonBody.totalDrawn).toBe(2);
        // Ensure state was updated
        const updatedState = testGameStates.get(testTxid);
        expect(updatedState.drawnNumbers).toContain(alreadyDrawn);
        expect(updatedState.drawnNumbers).toContain(uniqueNumber);
        expect(updatedState.nextDerivationIndex).toBe(2);
    });

    it('should handle full card win (fullCardOnly mode)', async () => {
        // Set up a game state where the next draw will win
        testGameStates.set(testTxid, {
            ...testGameStates.get(testTxid),
            drawnNumbers: Array.from({ length: 24 }, (_, i) => i + 1), // 24 numbers drawn
            nextDerivationIndex: 24,
            isOver: false,
            gameMode: 'fullCardOnly',
            fullCardWinners: null,
            cards: [{ cardId: 'card-alice', username: 'Alice', grid: { B: [], I: [], N: [null], G: [], O: [] } }]
        });
        vi.mocked(utils.derivePublicKey).mockReturnValue(Buffer.from('mock-pub-key'));
        vi.mocked(utils.checkFullCardWin).mockReturnValue(true);
        vi.mocked(utils.checkLineWin).mockReturnValue(null);

        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(200);
        expect(response.body.isOver).toBe(true);
        expect(response.body.fullCardWinners).not.toBeNull();
        expect(Array.isArray(response.body.fullCardWinners)).toBe(true);
        expect(response.body.fullCardWinners.length).toBeGreaterThan(0);
        expect(response.body.message).toMatch(/win|winner/i);
        // State should be updated
        const updatedState = testGameStates.get(testTxid);
        expect(updatedState.isOver).toBe(true);
        expect(updatedState.fullCardWinners).not.toBeNull();
    });

    it('should detect a real partial win (O column) for Grace Lee when the 31st number is drawn', () => {
        // Grace Lee's real card grid (from screenshot)
        const graceGrid = {
            B: [10, 7, 11, 4, 8],
            I: [22, 23, 20, 19, 26],
            N: [39, 42, null, 38, 35],
            G: [46, 49, 59, 50, 58],
            O: [64, 71, 61, 74, 65]
        };
        // Drawn numbers just before the win (missing 65)
        const drawnNumbers = [27, 15, 61, 28, 29, 10, 45, 74, 51, 67, 56, 14, 67, 35, 48, 7, 66, 64, 71, 11, 20, 59, 4, 19, 38, 50, 8, 26, 58];
        // The 31st number to be drawn is 65 (completing the O column)
        const nextNumber = 65;
        // Set up the game state
        testGameStates.set('test-txid-grace', {
            txid: 'test-txid-grace',
            status: 'initialized',
            blockHash: '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f',
            participants: [{ name: 'Grace Lee', ticket: '8' }],
            baseSeed: '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f',
            drawnNumbers: drawnNumbers.slice(),
            drawSequence: [],
            nextDerivationIndex: 30,
            gmToken: 'gm-token-grace',
            lastDrawTime: null,
            creationTime: Date.now(),
            isOver: false,
            gameMode: 'partialAndFull',
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null,
            continueAfterPartialWin: false,
            winners: [],
            cards: [{ cardId: 'card-grace', username: 'Grace Lee', grid: graceGrid }]
        });
        // Mock utils to return the next number as 65 and checkLineWin to return the O column when 65 is present
        const mockUtils = {
            ...utils,
            derivePublicKey: vi.fn(() => Buffer.from('mock-pub-key')),
            hashPublicKeyToNumber: vi.fn(() => nextNumber),
            checkLineWin: (grid, drawnSet) => {
                // Only return a win if all O column numbers are in the set
                const oCol = grid.O;
                if (oCol.every(num => drawnSet.has(num))) {
                    return oCol;
                }
                return null;
            },
            checkFullCardWin: vi.fn(() => false)
        };
        // Mock req/res
        const req = {
            params: { txid: 'test-txid-grace' },
            headers: { authorization: 'Bearer gm-token-grace' }
        };
        let statusCode, jsonBody;
        const res = {
            status(code) { statusCode = code; return this; },
            json(body) { jsonBody = body; return this; }
        };
        handleDraw(req, res, mockUtils);
        expect(statusCode).toBe(200);
        expect(jsonBody.partialWinOccurred).toBe(true);
        expect(jsonBody.partialWinners).not.toBeNull();
        expect(Array.isArray(jsonBody.partialWinners)).toBe(true);
        expect(jsonBody.partialWinners.length).toBeGreaterThan(0);
        expect(jsonBody.partialWinners[0].username).toBe('Grace Lee');
        expect(jsonBody.partialWinners[0].sequence).toEqual([64, 71, 61, 74, 65]);
        expect(jsonBody.message).toMatch(/partial win|winner/i);
        // State should be updated
        const updatedState = testGameStates.get('test-txid-grace');
        expect(updatedState.partialWinOccurred).toBe(true);
        expect(updatedState.partialWinners).not.toBeNull();
    });

    it('should return 401 if GM token is missing', async () => {
        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .send(); // No Authorization header
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: 'Authorization token required for drawing numbers.' });
    });

    it('should return 403 if GM token is invalid', async () => {
        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .set('Authorization', 'Bearer invalid-token')
            .send();
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: 'Invalid authorization token.' });
    });

    it('should return 500 if an error occurs during number derivation', () => {
        // Set up a minimal valid game state
        testGameStates.set('test-txid-derivation-error', {
            txid: 'test-txid-derivation-error',
            status: 'initialized',
            blockHash: 'blockhash',
            participants: [{ name: 'Alice', ticket: '1' }],
            baseSeed: 'blockhash',
            drawnNumbers: [],
            drawSequence: [],
            nextDerivationIndex: 0,
            gmToken: 'gm-token-derivation',
            lastDrawTime: null,
            creationTime: Date.now(),
            isOver: false,
            gameMode: 'fullCardOnly',
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null,
            continueAfterPartialWin: false,
            winners: [],
            cards: [{ cardId: 'card-alice', username: 'Alice', grid: { B: [1,2,3,4,5], I: [6,7,8,9,10], N: [11,12,null,14,15], G: [16,17,18,19,20], O: [21,22,23,24,25] } }]
        });
        // Mock utils to throw on derivePublicKey
        const mockUtils = {
            ...utils,
            derivePublicKey: () => { throw new Error('Derivation failed!'); },
            hashPublicKeyToNumber: vi.fn(),
            checkLineWin: vi.fn(),
            checkFullCardWin: vi.fn()
        };
        // Mock req/res
        const req = {
            params: { txid: 'test-txid-derivation-error' },
            headers: { authorization: 'Bearer gm-token-derivation' }
        };
        let statusCode, jsonBody;
        const res = {
            status(code) { statusCode = code; return this; },
            json(body) { jsonBody = body; return this; }
        };
        handleDraw(req, res, mockUtils);
        expect(statusCode).toBe(500);
        expect(jsonBody).toEqual({ message: expect.stringContaining('Failed to derive number: Derivation failed!') });
    });

    // --- TODO: Add/Unskip tests for other stories ---
    // it('should return 400 if game is already over', async () => { ... });
    // it('should return 400 if all numbers are already drawn', async () => { ... });
    // it('should handle uniqueness constraint (require multiple derivations)', async () => { ... });
    // it('should return 401/403 if caller provides invalid/missing token', async () => { ... });
    // it('should handle errors during derivation', async () => { ... });
    // it('should handle win condition correctly', async () => { ... }); 
}); 