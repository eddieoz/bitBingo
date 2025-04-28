import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, gameStates as testGameStates } from '../index'; // Import app and gameStates

// --- Test Suite Setup ---
let server;

describe('POST /api/end-game/:txid', () => {
    const testTxid = 'test-txid-for-end-game';
    const mockGmToken = 'gm-token-for-ending';
    const partialWinnersList = [{ username: 'Alice', cardId: 'c1' }];

    beforeAll(async () => {
        server = app.listen(0); // Start server on random port
        console.log(`[Test Server - api.end-game.test.js] Started on port ${server.address().port}`);
    });

    afterAll(async () => {
        await new Promise(resolve => server.close(resolve)); // Close server
        console.log(`[Test Server - api.end-game.test.js] Closed.`);
    });

    beforeEach(() => {
        testGameStates.clear(); // Clear game states before each test
    });

    afterEach(() => {
        testGameStates.clear();
    });

    // --- Test Cases ---

    it('should successfully end the game if conditions are met', async () => {
        // Setup initial state
        testGameStates.set(testTxid, {
            txid: testTxid,
            status: 'active', // Game is active
            gameMode: 'partialAndFull',
            partialWinOccurred: true, // Partial win happened
            partialWinners: partialWinnersList,
            isOver: false, // Game is not over yet
            gmToken: mockGmToken,
            // ... other necessary state properties
            drawnNumbers: [1, 2, 3],
            blockHash: 'hash',
            participants: [],
            baseSeed: 'seed',
            cards: [],
            drawSequence: [],
            nextDerivationIndex: 1,
            lastDrawTime: null,
            fullCardWinners: null,
            continueAfterPartialWin: false,
            winners: [],
        });

        const response = await request(server)
            .post(`/api/end-game/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            message: 'Game successfully ended by Game Master.',
            isOver: true,
            partialWinners: partialWinnersList
        });

        // Verify game state update
        const updatedState = testGameStates.get(testTxid);
        expect(updatedState).toBeDefined();
        expect(updatedState.isOver).toBe(true);
    });

    it('should return 404 if game txid does not exist', async () => {
        const nonExistentTxid = 'non-existent-txid';
        const response = await request(server)
            .post(`/api/end-game/${nonExistentTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ message: 'Game not found.' });
    });

    it('should return 401 if GM token is missing', async () => {
         testGameStates.set(testTxid, { // Need a valid state for the check
            txid: testTxid, gameMode: 'partialAndFull', partialWinOccurred: true, isOver: false, gmToken: mockGmToken
         });

        const response = await request(server)
            .post(`/api/end-game/${testTxid}`)
            // No Authorization header
            .send();

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: 'Authorization token required.' });
    });

    it('should return 403 if GM token is invalid', async () => {
        testGameStates.set(testTxid, { // Need a valid state for the check
            txid: testTxid, gameMode: 'partialAndFull', partialWinOccurred: true, isOver: false, gmToken: mockGmToken
         });

        const response = await request(server)
            .post(`/api/end-game/${testTxid}`)
            .set('Authorization', `Bearer invalid-token`)
            .send();

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: 'Invalid authorization token.' });
    });

    it('should return 400 if game is already over', async () => {
        testGameStates.set(testTxid, {
            txid: testTxid,
            status: 'ended',
            gameMode: 'partialAndFull',
            partialWinOccurred: true,
            partialWinners: partialWinnersList,
            isOver: true, // Game is already over
            gmToken: mockGmToken,
        });

        const response = await request(server)
            .post(`/api/end-game/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Game is already over.' });
    });

    it('should return 400 if gameMode is not partialAndFull', async () => {
        testGameStates.set(testTxid, {
            txid: testTxid,
            status: 'active',
            gameMode: 'fullCardOnly', // Incorrect mode
            partialWinOccurred: false, // Doesn't matter for this mode
            isOver: false,
            gmToken: mockGmToken,
        });

        const response = await request(server)
            .post(`/api/end-game/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Game can only be ended manually after a partial win in PartialAndFull mode.' });
    });

     it('should return 400 if partialWinOccurred is false', async () => {
        testGameStates.set(testTxid, {
            txid: testTxid,
            status: 'active',
            gameMode: 'partialAndFull',
            partialWinOccurred: false, // Partial win has not occurred
            isOver: false,
            gmToken: mockGmToken,
        });

        const response = await request(server)
            .post(`/api/end-game/${testTxid}`)
            .set('Authorization', `Bearer ${mockGmToken}`)
            .send();

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Game can only be ended manually after a partial win in PartialAndFull mode.' });
    });
}); 