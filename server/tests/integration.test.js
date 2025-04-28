vi.mock('axios');

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// import request from 'supertest'; // No longer needed for the refactored test
import axios from 'axios';
import fs from 'fs'; // Original fs for spyOn
import fsPromises from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

// Mock external dependencies
vi.mock('fs/promises');
vi.mock('crypto', () => ({
    randomBytes: () => Buffer.from('0123456789abcdef'),
}));
// path is NOT mocked globally

// --- Remove vi.mock for utils --- 
// const mockFetchTxDataAndBlockHash = vi.fn();
// const mockGetParticipantsFromOpReturn = vi.fn();
// const mockGenerateAllCards = vi.fn();

// vi.mock('../utils', () => ({
//     fetchTxDataAndBlockHash: mockFetchTxDataAndBlockHash,
//     getParticipantsFromOpReturn: mockGetParticipantsFromOpReturn,
//     generateAllCards: mockGenerateAllCards,
// }));

// --- Import utils directly ---
const utils = require('../utils');
import { handleCheckTransaction, gameStates, uploadDir, app } from '../index';
let server;

vi.mock('../utils', () => ({
    fetchTxDataAndBlockHash: vi.fn(),
    getParticipantsFromOpReturn: vi.fn(),
    generateAllCards: vi.fn(),
    // ... add other utils as needed
}));

// --- Define spies for utils functions ---
// Restore fetchTxSpy
let fetchTxSpy, getParticipantsSpy, generateCardsSpy;

describe('API Endpoint Handlers', () => { // Changed describe block name

    beforeEach(() => {
        vi.clearAllMocks(); // Clears external mocks like fs, crypto

        // --- Use vi.spyOn to mock utils functions ---
        fetchTxSpy = vi.spyOn(utils, 'fetchTxDataAndBlockHash');
        getParticipantsSpy = vi.spyOn(utils, 'getParticipantsFromOpReturn');
        generateCardsSpy = vi.spyOn(utils, 'generateAllCards');
        // --- End spyOn setup ---

        // Clear gameStates
        gameStates.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks(); // This should restore the spies as well
    });

    describe('handleCheckTransaction (POST /api/check-transaction)', () => {
        // --- Refactored Test ---
        it('should successfully initialize a new game via handler', async () => {
            const mockTxId = 'valid-txid-simple';
            const mockInputFilename = 'participants-simple.csv';
            const mockBlockHash = 'mock-block-hash-simple';
            const mockOpReturnHex = 'mock-op-return-hex-simple';
            const mockParticipants = [{ name: 'Alice' }, { name: 'Bob' }];
            const mockCards = [ { cardId: 'c1'}, { cardId: 'c2'} ];
            const mockGameMode = 'fullCardOnly';

            // --- Setup Mocks ---
            utils.fetchTxDataAndBlockHash.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
            utils.getParticipantsFromOpReturn.mockResolvedValue(mockParticipants);
            utils.generateAllCards.mockReturnValue(mockCards);
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            fsPromises.unlink.mockResolvedValue(undefined);

            // --- Mock Request and Response Objects ---
            const mockReq = {
                body: { 
                    txid: mockTxId, 
                    participantFilename: mockInputFilename, 
                    gameMode: mockGameMode 
                }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };

            // --- Call the handler directly ---
            await handleCheckTransaction(mockReq, mockRes);

            // --- Assertions ---
            expect(mockRes.status).toHaveBeenCalledWith(200);
            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(jsonCall).toMatchObject({
                message: 'Transaction confirmed and game state initialized.',
                txid: mockTxId,
                blockHash: mockBlockHash,
                participantCount: mockParticipants.length,
            });
            expect(typeof jsonCall.gmToken).toBe('string');
            expect(jsonCall.gmToken).toMatch(/^[a-f0-9]{32}$/);

            // Assert game state is created
            expect(gameStates.has(mockTxId)).toBe(true);
            const createdState = gameStates.get(mockTxId);
            expect(createdState).toEqual(expect.objectContaining({
                txid: mockTxId,
                status: 'initialized',
                blockHash: mockBlockHash,
                participants: mockParticipants,
                baseSeed: mockBlockHash,
                cards: mockCards,
                drawnNumbers: [],
                nextDerivationIndex: 0,
                gameMode: mockGameMode,
                isOver: false
            }));
        });

        it('should return 404 if participant file does not exist', async () => {
            const mockTxId = 'valid-txid-file-not-found';
            const mockInputFilename = 'nonexistent.csv';
            const mockGameMode = 'partialAndFull';
            const expectedCheckPath = path.join(uploadDir, mockInputFilename); // Use real path.join

            // --- Setup Mocks ---
            const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
            // No need to configure utils spies as they shouldn't be called
            // --- End Mock Setup ---

             // --- Mock Request and Response Objects ---
             const mockReq = {
                body: { 
                    txid: mockTxId, 
                    participantFilename: mockInputFilename, 
                    gameMode: mockGameMode 
                }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            // --- End Mock Req/Res ---

            // --- Call the handler directly ---
            await handleCheckTransaction(mockReq, mockRes);
            // --- End Handler Call ---

            // --- Assertions ---
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Participant file not found.' });
            
            // Assert only relevant mocks/spies were called
            expect(existsSyncSpy).toHaveBeenCalledWith(expectedCheckPath); // Assert with path calculated using real path.join
            // Restore fetchTxSpy assertion
            expect(fetchTxSpy).not.toHaveBeenCalled();
            // expect(axios.get).not.toHaveBeenCalled(); // Remove axios check
            expect(getParticipantsSpy).not.toHaveBeenCalled();
            expect(generateCardsSpy).not.toHaveBeenCalled();
            expect(fsPromises.unlink).not.toHaveBeenCalled();
            expect(gameStates.has(mockTxId)).toBe(false);
        });

        // --- Additional tests for full coverage (Story 6B) ---
        it('should return 200 and not re-initialize if game already exists', async () => {
            const mockTxId = 'existing-txid';
            const mockInputFilename = 'participants-existing.csv';
            const mockBlockHash = 'mock-block-hash-existing';
            const mockOpReturnHex = 'mock-op-return-hex-existing';
            const mockParticipants = [{ name: 'Alice' }, { name: 'Bob' }];
            const mockCards = [ { cardId: 'c1'}, { cardId: 'c2'} ];
            const mockGameMode = 'partialAndFull';
            // Pre-populate gameStates
            gameStates.set(mockTxId, {
                txid: mockTxId,
                status: 'initialized',
                blockHash: mockBlockHash,
                participants: mockParticipants,
                baseSeed: mockBlockHash,
                cards: mockCards,
                drawnNumbers: [],
                nextDerivationIndex: 0,
                gameMode: mockGameMode,
                isOver: false,
                gmToken: 'existing-gm-token',
            });
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            // --- Mock Request and Response Objects ---
            const mockReq = {
                body: { 
                    txid: mockTxId, 
                    participantFilename: mockInputFilename, 
                    gameMode: mockGameMode 
                }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            await handleCheckTransaction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(jsonCall).not.toHaveProperty('gmToken');
            expect(gameStates.get(mockTxId).gmToken).toBe('existing-gm-token');
        });

        it('should return 400 if txid is missing', async () => {
            const mockReq = {
                body: { participantFilename: 'file.csv', gameMode: 'fullCardOnly' }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            await handleCheckTransaction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Missing txid or participantFilename in request body.' });
        });

        it('should return 400 if participantFilename is missing', async () => {
            const mockReq = {
                body: { txid: 'some-txid', gameMode: 'partialAndFull' }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            await handleCheckTransaction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Missing txid or participantFilename in request body.' });
        });

        it('should return 400 if gameMode is missing or invalid', async () => {
            const mockReq = {
                body: { txid: 'some-txid', participantFilename: 'file.csv' }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            await handleCheckTransaction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ message: expect.stringContaining('Invalid or missing gameMode') });
        });

        it('should return 500 if fetchTxDataAndBlockHash throws (TX Fetch Error)', async () => {
            const mockTxId = 'txid-fetch-error';
            const mockInputFilename = 'file.csv';
            const mockGameMode = 'fullCardOnly';
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            utils.fetchTxDataAndBlockHash.mockRejectedValue(new Error('TX fetch failed'));
            const mockReq = {
                body: { txid: mockTxId, participantFilename: mockInputFilename, gameMode: mockGameMode }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            await handleCheckTransaction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ message: expect.stringContaining('TX fetch failed') });
        });

        it('should return 500 if getParticipantsFromOpReturn throws (IPFS Fetch Error)', async () => {
            const mockTxId = 'txid-ipfs-error';
            const mockInputFilename = 'file.csv';
            const mockBlockHash = 'mock-block-hash';
            const mockOpReturnHex = 'mock-op-return-hex';
            const mockGameMode = 'partialAndFull';
            vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            utils.fetchTxDataAndBlockHash.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
            utils.getParticipantsFromOpReturn.mockRejectedValue(new Error('IPFS fetch failed'));
            const mockReq = {
                body: { txid: mockTxId, participantFilename: mockInputFilename, gameMode: mockGameMode }
            };
            const mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            await handleCheckTransaction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ message: expect.stringContaining('IPFS fetch failed') });
        });
    });
}); 