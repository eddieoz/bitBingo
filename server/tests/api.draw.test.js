import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, gameStates as testGameStates } from '../index';
import * as utils from '../utils';

// Mock the utils module
vi.mock('../utils');

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
        vi.mocked(utils.hashPublicKeyToNumber).mockReturnValue(expectedDrawnNumber);
        vi.mocked(utils.checkLineWin).mockReturnValue(null);
        vi.mocked(utils.checkFullCardWin).mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        testGameStates.clear();
    });

    it.skip('Story: Successful Draw (No Win)', async () => {
        const response = await request(server)
            .post(`/api/draw/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.objectContaining({
            drawnNumber: expectedDrawnNumber,
            isOver: false,
            gameMode: 'fullCardOnly',
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null,
        }));
        expect(response.body.message).toBe('Number drawn successfully!');
        expect(response.body.totalDrawn).toBe(1);
        expect(response.body.nextDerivationIndex).toBe(1);

        const updatedState = testGameStates.get(testTxid);
        expect(updatedState).toBeDefined();
        expect(updatedState.drawnNumbers).toEqual([expectedDrawnNumber]);
        expect(updatedState.nextDerivationIndex).toBe(1);
        expect(updatedState.isOver).toBe(false);
        expect(updatedState.partialWinners).toBeNull();
        expect(updatedState.fullCardWinners).toBeNull();

        expect(utils.derivePublicKey).toHaveBeenCalled();
        expect(utils.hashPublicKeyToNumber).toHaveBeenCalled();
        expect(utils.checkLineWin).not.toHaveBeenCalled();
        expect(utils.checkFullCardWin).toHaveBeenCalled();
    });

    // --- TODO: Add/Unskip tests for other stories ---
    // it('should return 404 if game txid does not exist', async () => { ... });
    // it('should return 400 if game is already over', async () => { ... });
    // it('should return 400 if all numbers are already drawn', async () => { ... });
    // it('should handle uniqueness constraint (require multiple derivations)', async () => { ... });
    // it('should return 401/403 if caller provides invalid/missing token', async () => { ... });
    // it('should handle errors during derivation', async () => { ... });
    // it('should handle win condition correctly', async () => { ... }); 
}); 