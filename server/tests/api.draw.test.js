import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index'; // Import the Express app
// Remove direct import of the store
// import { gameStates } from '../gameStore'; 
import * as utils from '../utils'; // Import utils to mock its functions

// Mock the utils module
// vi.mock('../utils');

// Mock GM verification (Placeholder - implement actual check later)
// We might need to inject this or mock middleware if it's added to the route
const mockVerifyGM = (req, res, next) => {
    // In a real scenario, this would check auth tokens, etc.
    // For now, assume the caller is the GM for this test
    req.isGameMaster = true;
    next();
};
// Note: This mock middleware isn't automatically applied. The route needs to use it.
// We are testing the core logic first.

describe('POST /api/draw/:txid', () => {
    const testTxid = 'test-txid-for-draw-123';
    const baseSeed = '112233445566778899aabbccddeeff00'; 
    // Calculate the ACTUAL expected number for this seed and index 1
    // From logs: derivePublicKey(seed, 1) -> pubKey ending ...a943f250
    // From logs: hashPublicKeyToNumber(pubKey) -> 12
    const expectedDrawnNumber = 12; 

    const testGameStates = app.locals.gameStates;
    // Remove spy variable: let hashSpy;

    beforeEach(() => {
        // 1. Restore any potential leftover mocks/spies (good practice)
        vi.restoreAllMocks(); 

        // 2. Clear the gameStates map
        testGameStates.clear();

        // 3. Setup initial game state
        testGameStates.set(testTxid, {
            baseSeed: baseSeed,
            drawnNumbers: [],
            drawIndex: 0,
        });

        // 4. NO MOCKING/SPYING on utils functions needed for this test case anymore
        // hashSpy = vi.spyOn(utils, 'hashPublicKeyToNumber').mockReturnValue(expectedDrawnNumber);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        testGameStates.clear();
    });

    it('should draw the next unique number, update state, and return the number', async () => {
        // --- Given ---
        // Initial game state is set
        // Real utils functions will be used

        // --- When ---
        const response = await request(app)
            .post(`/api/draw/${testTxid}`)
            .send();

        // --- Then ---
        // Check response - expecting the *actual* calculated number (12)
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ drawnNumber: expectedDrawnNumber }); // Expect 12

        // Check state mutation
        const updatedState = testGameStates.get(testTxid);
        expect(updatedState).toBeDefined();
        expect(updatedState.drawIndex).toBe(1);
        expect(updatedState.drawnNumbers).toEqual([expectedDrawnNumber]); // Expect [12]

        // Cannot reliably verify internal calls to utils without mocks/spies
        // expect(hashSpy).toHaveBeenCalledTimes(1);
        // expect(hashSpy).toHaveBeenCalledWith(expect.any(Buffer)); 
    });

    // --- Add tests for other scenarios later ---
    // it('should return 404 if game txid does not exist', async () => { ... });
    // it('should return 400 if all numbers are already drawn', async () => { ... });
    // it('should handle uniqueness constraint (require multiple derivations)', async () => { ... });
    // it('should return 403 if caller is not the Game Master (when implemented)', async () => { ... });
    // it('should handle errors during derivation', async () => { ... });

}); 