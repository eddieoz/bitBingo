import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index'; // Import the Express app

// No need to mock anything specific for this basic test

describe('GET /api/game-state/:txid', () => {
    const testTxid = 'test-txid-for-state-456';
    const initialGameState = {
        baseSeed: 'seed-irrelevant-for-this-test',
        drawnNumbers: [10, 25, 71], // Example drawn numbers
        drawIndex: 3, // Example draw index
    };

    // Get a reference to the game state map via app.locals
    const testGameStates = app.locals.gameStates;

    beforeEach(() => {
        // Clear the map and set up the specific game state for this test
        testGameStates.clear();
        testGameStates.set(testTxid, { ...initialGameState });
    });

    afterEach(() => {
        // Cleanup
        testGameStates.clear();
    });

    it('should return the current drawn numbers and draw index for an existing game', async () => {
        // --- Given ---
        // Game state is set in beforeEach in app.locals.gameStates

        // --- When ---
        const response = await request(app)
            .get(`/api/game-state/${testTxid}`)
            .send();

        // --- Then ---
        // Check response status
        expect(response.status).toBe(200);

        // Check response body (only drawnNumbers and drawIndex are required by the task for basic state)
        expect(response.body).toEqual({
            drawnNumbers: initialGameState.drawnNumbers,
            drawIndex: initialGameState.drawIndex,
        });
    });

    // --- Add tests for other scenarios later ---
    it('should return 404 if game txid does not exist', async () => {
        // --- Given ---
        const nonExistentTxid = 'txid-does-not-exist';
        // Ensure the txid is not in the store (cleared in beforeEach)
        expect(testGameStates.has(nonExistentTxid)).toBe(false);

        // --- When ---
        const response = await request(app)
            .get(`/api/game-state/${nonExistentTxid}`)
            .send();

        // --- Then ---
        // Check response status
        expect(response.status).toBe(404);

        // Check response body for an error message (optional but good practice)
        expect(response.body).toEqual({ error: 'Game not found for the provided TXID.' });
    });

    // it('should return GM stats if requested by GM (when implemented)', async () => { ... });

}); 