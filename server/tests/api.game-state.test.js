import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
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
let server; // Variable to hold the server instance
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
        gameMode: 'partialAndFull',
        partialWinOccurred: false,
        partialWinners: null,
        fullCardWinners: null,
        continueAfterPartialWin: false
    };
    // Calculate the expected stats based on the actual function and initialGameState
    const expectedStatsString = "No players have 2 or more marks in a line yet."; // Max marks = 1 (free space)

    beforeAll(async () => {
        // Dynamically import app, start server, get gameStates map
        const serverModule = await import('../index');
        app = serverModule.app;
        gameStates = serverModule.gameStates;
        server = app.listen(0); // Start on random port
        console.log(`[Test Server - api.game-state.test.js] Started on port ${server.address().port}`);
    });

    afterAll(async () => {
        // Close the server after all tests in this suite are done
        await new Promise(resolve => server.close(resolve));
        console.log(`[Test Server - api.game-state.test.js] Closed.`);
        if (gameStates) gameStates.clear();
    });

    beforeEach(async () => {
        // REMOVED dynamic import from here
        // Reset game state before each test
        gameStates.clear();
        // Use a deep copy of initialGameState to avoid mutations between tests
        gameStates.set(testTxid, JSON.parse(JSON.stringify(initialGameState)));
    });

    afterEach(() => {
        // REMOVED vi.restoreAllMocks(); - Not using mocks here anymore
    });

    it('Story: Get State (Player)', async () => {
        // --- Given ---
        // Game state is set in beforeEach

        // --- When ---
        const response = await request(server) // Use server
            .get(`/api/game-state/${testTxid}`)
            .send();

        // --- Then ---
        expect(response.status).toBe(200);

        expect(response.body).toEqual(expect.objectContaining({
            drawnNumbers: initialGameState.drawnNumbers,
            isOver: initialGameState.isOver,
            gameMode: initialGameState.gameMode,
            partialWinOccurred: initialGameState.partialWinOccurred,
            partialWinners: initialGameState.partialWinners,
            fullCardWinners: initialGameState.fullCardWinners,
            statistics: expect.any(String)
        }));
        // Check specific fields if needed outside objectContaining
        expect(response.body.statistics).toEqual(expectedStatsString);
        // Ensure fields specific to GM view are NOT present
        expect(response.body).not.toHaveProperty('continueAfterPartialWin');
    });

    it('Story: Get State (GM)', async () => {
        // --- Given ---
        // Game state is set in beforeEach
        // REMOVED: utils.calculateMaxMarkedInLine is NOT mocked anymore

        // --- When ---
        const response = await request(server) // Use server
            .get(`/api/game-state/${testTxid}?gm=true`) 
            .send();

        // --- Then ---
        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.objectContaining({
            drawnNumbers: initialGameState.drawnNumbers,
            isOver: initialGameState.isOver,
            gameMode: initialGameState.gameMode,
            partialWinOccurred: initialGameState.partialWinOccurred,
            partialWinners: initialGameState.partialWinners,
            fullCardWinners: initialGameState.fullCardWinners,
            continueAfterPartialWin: initialGameState.continueAfterPartialWin,
            statistics: expect.any(String)
        }));
        // Check specific fields if needed outside objectContaining
        expect(response.body.statistics).toEqual(expectedStatsString);
    });

    it('Story: Get State for Non-existent Game', async () => {
        // --- Given ---
        const nonExistentTxid = 'txid-does-not-exist';
        // Ensure state is clear
        gameStates.delete(nonExistentTxid);
        expect(gameStates.has(nonExistentTxid)).toBe(false);

        // --- When ---
        const response = await request(server) // Use server
            .get(`/api/game-state/${nonExistentTxid}`)
            .send();

        // --- Then ---
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ message: 'Game not found.' }); 
    });

}); 