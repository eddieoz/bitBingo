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

    // --- NEW Test Cases for Different States/Modes ---

    it('Story: Get State (fullCardOnly mode)', async () => {
        // Setup state for fullCardOnly mode
        gameStates.set(testTxid, {
            ...JSON.parse(JSON.stringify(initialGameState)),
            gameMode: 'fullCardOnly',
            partialWinOccurred: false, // Should remain false
            partialWinners: null, // Should remain null
            continueAfterPartialWin: false // Should remain false
        });

        // Player view
        const playerResponse = await request(server)
            .get(`/api/game-state/${testTxid}`)
            .send();

        expect(playerResponse.status).toBe(200);
        expect(playerResponse.body).toEqual(expect.objectContaining({
            gameMode: 'fullCardOnly',
            isOver: false,
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null
        }));
        expect(playerResponse.body).not.toHaveProperty('continueAfterPartialWin');

        // GM view
        const gmResponse = await request(server)
            .get(`/api/game-state/${testTxid}?gm=true`)
            .send();
        
        expect(gmResponse.status).toBe(200);
        expect(gmResponse.body).toEqual(expect.objectContaining({
            gameMode: 'fullCardOnly',
            isOver: false,
            partialWinOccurred: false,
            partialWinners: null,
            fullCardWinners: null,
            continueAfterPartialWin: false // Included for GM
        }));
    });

    it('Story: Get State (partialAndFull mode, after partial win)', async () => {
        const partialWinnersList = [{ username: 'Alice', cardId: 'c1' }];
        gameStates.set(testTxid, {
            ...JSON.parse(JSON.stringify(initialGameState)),
            gameMode: 'partialAndFull',
            partialWinOccurred: true, // Partial win occurred
            partialWinners: partialWinnersList, // Winners set
            continueAfterPartialWin: false // GM hasn't continued yet
        });

        // Player view
        const playerResponse = await request(server)
            .get(`/api/game-state/${testTxid}`)
            .send();

        expect(playerResponse.status).toBe(200);
        expect(playerResponse.body).toEqual(expect.objectContaining({
            gameMode: 'partialAndFull',
            isOver: false,
            partialWinOccurred: true,
            partialWinners: partialWinnersList,
            fullCardWinners: null
        }));
        expect(playerResponse.body).not.toHaveProperty('continueAfterPartialWin');
    });

    it('Story: Get State (partialAndFull mode, after partial win, GM continued)', async () => {
        const partialWinnersList = [{ username: 'Alice', cardId: 'c1' }];
        gameStates.set(testTxid, {
            ...JSON.parse(JSON.stringify(initialGameState)),
            gameMode: 'partialAndFull',
            partialWinOccurred: true,
            partialWinners: partialWinnersList,
            continueAfterPartialWin: true // GM continued
        });

        // GM view (only GM sees the continue flag directly)
        const gmResponse = await request(server)
            .get(`/api/game-state/${testTxid}?gm=true`)
            .send();
        
        expect(gmResponse.status).toBe(200);
        expect(gmResponse.body).toEqual(expect.objectContaining({
            gameMode: 'partialAndFull',
            isOver: false,
            partialWinOccurred: true,
            partialWinners: partialWinnersList,
            fullCardWinners: null,
            continueAfterPartialWin: true // Should be true for GM
        }));
    });

    it('Story: Get State (Game Over with Full Card Winner)', async () => {
        const fullWinnersList = [{ username: 'Bob', cardId: 'c2' }];
        gameStates.set(testTxid, {
            ...JSON.parse(JSON.stringify(initialGameState)),
            gameMode: 'fullCardOnly', // Could be either mode if game is over
            isOver: true, // Game is over
            fullCardWinners: fullWinnersList, // Full card winner set
            // Partial fields might or might not be set depending on mode/history
            partialWinOccurred: false, 
            partialWinners: null,
            continueAfterPartialWin: false
        });

        // Player view
        const playerResponse = await request(server)
            .get(`/api/game-state/${testTxid}`)
            .send();

        expect(playerResponse.status).toBe(200);
        expect(playerResponse.body).toEqual(expect.objectContaining({
            gameMode: 'fullCardOnly',
            isOver: true,
            fullCardWinners: fullWinnersList,
            partialWinOccurred: false,
            partialWinners: null,
        }));
    });

}); 