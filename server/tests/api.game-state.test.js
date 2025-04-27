import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
// import app from '../index'; // Delay import
// No longer mocking utils for this test file
// import * as utils from '../utils';

// // Mock utils selectively for calculateMaxMarkedInLine
// vi.mock('../utils', async () => {
//     const actualUtils = await vi.importActual('../utils');
//     return {
//         ...actualUtils,
//         calculateMaxMarkedInLine: vi.fn(), // Only mock this one
//     };
// });

// --- Test Suite ---
let app;
let gameStates;

describe('GET /api/game-state/:txid', () => {
    const testTxid = 'test-txid-for-state-456';
    const mockGmToken = 'gm-token-for-state-test'; 
    const initialGameState = {
        txid: testTxid,
        status: 'initialized', 
        blockHash: 'state-test-block-hash',
        participants: [{ name: 'Alice' }],
        baseSeed: 'state-test-seed',
        // Use a slightly more realistic grid for testing stats calculation
        cards: [{ cardId: 'card-state-alice', username: 'Alice', grid: {
            B: [1,2,3,4,5],
            I: [16,17,18,19,20],
            N: [31,32,null,34,35],
            G: [46,47,48,49,50],
            O: [61,62,63,64,65]
        } }], 
        drawnNumbers: [10, 25, 71], // Numbers not on the card
        drawSequence: [{}, {}, {}], 
        nextDerivationIndex: 3, 
        gmToken: mockGmToken,
        lastDrawTime: new Date(Date.now() - 10000).toISOString(), 
        creationTime: Date.now() - 20000,
        isOver: false, 
        winners: [] 
    };
    // Calculate the expected stats based on the actual function and initialGameState
    const expectedStatsString = "No players have 2 or more marks in a line yet."; // Max marks = 1 (free space)

    beforeEach(async () => {
        // REMOVED: Mock setup
        // vi.mocked(utils.calculateMaxMarkedInLine).mockReturnValue(3); 

        // Dynamically import app and gameStates 
        const serverModule = await import('../index');
        app = serverModule.app;
        gameStates = serverModule.gameStates; 
        gameStates.clear();
        
        gameStates.set(testTxid, { ...initialGameState }); 
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Still useful if other tests add spies
    });

    it('Story: Get State (Player)', async () => {
        // --- Given ---
        // Game state is set in beforeEach

        // --- When ---
        const response = await request(app)
            .get(`/api/game-state/${testTxid}`)
            .send();

        // --- Then ---
        expect(response.status).toBe(200);

        expect(response.body).toEqual(expect.objectContaining({
            status: initialGameState.status,
            drawnNumbers: initialGameState.drawnNumbers,
            drawSequenceLength: initialGameState.drawSequence.length, 
            lastDrawTime: initialGameState.lastDrawTime, 
            isOver: initialGameState.isOver,
            winners: initialGameState.winners,
            statistics: expectedStatsString // Assert the actual calculated stats string
        }));
        // REMOVED: Mock assertion
        // expect(utils.calculateMaxMarkedInLine).toHaveBeenCalled();
    });

    it('Story: Get State (GM)', async () => {
        // --- Given ---
        // Game state is set in beforeEach
        // REMOVED: utils.calculateMaxMarkedInLine is NOT mocked anymore

        // --- When ---
        const response = await request(app)
            .get(`/api/game-state/${testTxid}?gm=true`) 
            .send();

        // --- Then ---
        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.objectContaining({
            status: initialGameState.status,
            drawnNumbers: initialGameState.drawnNumbers,
            drawSequenceLength: initialGameState.drawSequence.length, 
            lastDrawTime: initialGameState.lastDrawTime, 
            isOver: initialGameState.isOver,
            winners: initialGameState.winners,
            statistics: expectedStatsString // Assert the actual calculated stats string
        }));
        // REMOVED: Mock assertion
        // expect(utils.calculateMaxMarkedInLine).toHaveBeenCalledTimes(initialGameState.cards.length);
    });

    it('Story: Get State for Non-existent Game', async () => {
        // --- Given ---
        const nonExistentTxid = 'txid-does-not-exist';
        expect(gameStates.has(nonExistentTxid)).toBe(false);

        // --- When ---
        const response = await request(app)
            .get(`/api/game-state/${nonExistentTxid}`)
            .send();

        // --- Then ---
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ message: 'Game not found.' }); 
    });

}); 