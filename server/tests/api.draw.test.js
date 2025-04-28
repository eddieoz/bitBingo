import { vi } from 'vitest';
vi.mock('../utils');

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as utils from '../utils';

import { app, gameStates as testGameStates, handleDraw } from '../index';

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

    // --- TODO: Add/Unskip tests for other stories ---
    // it('should return 400 if game is already over', async () => { ... });
    // it('should return 400 if all numbers are already drawn', async () => { ... });
    // it('should handle uniqueness constraint (require multiple derivations)', async () => { ... });
    // it('should return 401/403 if caller provides invalid/missing token', async () => { ... });
    // it('should handle errors during derivation', async () => { ... });
    // it('should handle win condition correctly', async () => { ... }); 
}); 