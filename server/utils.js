const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const crypto = require('crypto');
const axios = require('axios'); // Needed for API calls
const csvtojson = require('csvtojson'); // Needed for parsing
const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const bip32 = require('@scure/bip32');
const fs = require('fs');
const path = require('path');
const CID = require('cids');
const bs58 = require('bs58');
require('dotenv').config({ path: path.resolve(__dirname, './.env') }); // Ensure correct .env path

// Environment variables (Consider moving config to a dedicated file later)
const PINATA_PUBLIC_GATEWAY_BASE = process.env.PINATA_PUBLIC_GATEWAY_BASE || 'https://ipfs.io/ipfs';
const BLOCKCYPHER_API_BASE_URL = process.env.BLOCKCYPHER_API_BASE_URL || 'https://api.blockcypher.com/v1';
const BLOCKCYPHER_NETWORK = process.env.BLOCKCYPHER_NETWORK || 'main';

/**
 * Derives a BIP32 public key for a given seed hash and index.
 * Uses the path m/44'/0'/0'/0/index.
 * 
 * @param {string} seedHash - The seed hash (e.g., previous block hash) in hex format.
 * @param {number} index - The derivation index (e.g., 1-based line number).
 * @returns {Buffer} The derived public key.
 */
function derivePublicKey(seedHash, index) {
  if (!seedHash || typeof seedHash !== 'string' || seedHash.length === 0) {
    throw new Error('Invalid seedHash provided for key derivation.');
  }
  if (typeof index !== 'number' || index < 0) { // Allow index 0 if needed, but usually 1-based
    throw new Error(`Invalid index provided for key derivation: ${index}`);
  }

  try {
    const bip32 = BIP32Factory(ecc);
    const seedBuffer = Buffer.from(seedHash, 'hex');
    const root = bip32.fromSeed(seedBuffer);
    const derivationPath = `m/44'/0'/0'/0/${index}`;
    const child = root.derivePath(derivationPath);
    console.log(`Derived public key for index ${index} using path ${derivationPath}`);
    const pubKeyBuffer = Buffer.from(child.publicKey);
    console.log(`[derivePublicKey] Type of pubKeyBuffer: ${typeof pubKeyBuffer}, Is Buffer: ${Buffer.isBuffer(pubKeyBuffer)}, Value (hex): ${pubKeyBuffer?.toString('hex')}`);
    return pubKeyBuffer;
  } catch (error) {
    console.error(`Error deriving public key for index ${index}:`, error);
    throw new Error(`Failed to derive public key for index ${index}: ${error.message}`);
  }
}

/**
 * Generates a deterministic 5x5 Bingo card from a public key using SHA-256 hashing.
 * B: 1–15, I: 16–30, N: 31–45, G: 46–60, O: 61–75. Center ('N'[2]) is free (null).
 * Numbers must be unique within each column.
 * 
 * @param {Buffer} publicKey - The public key used to seed card generation.
 * @returns {{cardId: string, grid: {B: number[], I: number[], N: (number|null)[], G: number[], O: number[]}}} An object containing a card ID and the 5x5 grid.
 */
function generateBingoCard(publicKey) {
  console.log(`[generateBingoCard] Received publicKey type: ${typeof publicKey}, Is Buffer: ${Buffer.isBuffer(publicKey)}, Value (hex): ${publicKey?.toString('hex')}`);
  if (!publicKey || !Buffer.isBuffer(publicKey) || publicKey.length === 0) {
    throw new Error('Invalid publicKey provided for card generation.');
  }

  const cardId = `card-${publicKey.toString('hex').slice(-8)}`; // Use last 8 hex digits as a simple ID
  const grid = { B: [], I: [], N: [], G: [], O: [] };
  const ranges = {
    B: { min: 1, max: 15, size: 15 },
    I: { min: 16, max: 30, size: 15 },
    N: { min: 31, max: 45, size: 15 },
    G: { min: 46, max: 60, size: 15 },
    O: { min: 61, max: 75, size: 15 },
  };

  let hash = crypto.createHash('sha256').update(publicKey).digest();
  let hashOffset = 0;

  function getNextHashInt(byteLength = 2) {
    if (hashOffset + byteLength > hash.length) {
      // Re-hash if we run out of bytes from the initial hash
      // Incorporate the offset to ensure subsequent hashes differ
      console.log('Re-hashing for card generation...');
      hash = crypto.createHash('sha256').update(hash).update(Buffer.from([hashOffset])).digest();
      hashOffset = 0; 
    }
    const value = hash.readUIntBE(hashOffset, byteLength);
    hashOffset += byteLength;
    return value;
  }

  for (const col of ['B', 'I', 'N', 'G', 'O']) {
    const usedInCol = new Set();
    const range = ranges[col];
    
    while (grid[col].length < 5) {
        // Special handling for the center free space in N column
        if (col === 'N' && grid[col].length === 2) {
            grid[col].push(null); 
            continue; // Move to the next slot
        }

        let num;
        let attempts = 0;
        do {
            const hashInt = getNextHashInt(2); // Use 2 bytes for better distribution
            num = (hashInt % range.size) + range.min;
            attempts++;
            if (attempts > range.size * 2 && !usedInCol.has(num)) { 
              // Safety break: If we somehow struggle to find a unique number 
              // (highly unlikely with SHA-256), log and potentially force-add.
              // This avoids infinite loops in extremely rare hash collision scenarios within the limited range.
              console.warn(`High attempt count (${attempts}) finding unique number for ${col}. Current hash offset: ${hashOffset}`);
              // For now, let's just proceed, but this indicates a potential issue or very bad luck.
            }
             if (attempts > range.size * 5) { // Stronger safety break
                throw new Error(`Could not generate unique number for column ${col} after many attempts.`);
             }
        } while (usedInCol.has(num));

        grid[col].push(num);
        usedInCol.add(num);
    }
  }

  console.log(`Generated card grid for pubKey ending in ...${publicKey.toString('hex').slice(-8)}`);
  return { cardId, grid };
}

/**
 * Hashes a public key (SHA-256), takes the last 8 hex digits (4 bytes),
 * converts to a decimal, and maps it to a bingo number (1-75).
 *
 * @param {Buffer} publicKey - The public key buffer.
 * @returns {number} A number between 1 and 75.
 */
function hashPublicKeyToNumber(publicKey) {
  if (!publicKey || !Buffer.isBuffer(publicKey) || publicKey.length === 0) {
    throw new Error('Invalid publicKey provided for number generation.');
  }

  try {
    const hash = crypto.createHash('sha256').update(publicKey).digest();
    // Take the last 4 bytes (8 hex digits) of the hash
    const last4Bytes = hash.slice(-4);
    // Read as an unsigned 32-bit integer (Big Endian)
    const decimalValue = last4Bytes.readUInt32BE(0);

    // Map to the range 1-75
    const bingoNumber = (decimalValue % 75) + 1;

    console.log(`Hashed pubKey ending ...${publicKey.toString('hex').slice(-8)} to number: ${bingoNumber}`);
    return bingoNumber;
  } catch (error) {
    console.error(`Error hashing public key to number:`, error);
    throw new Error(`Failed to hash public key to number: ${error.message}`);
  }
}

// --- NEW Extracted Functions --- 

/**
 * Fetches transaction data from BlockCypher, ensures it's confirmed,
 * and extracts the block hash and OP_RETURN data hex.
 * 
 * @param {string} txId The transaction ID.
 * @returns {Promise<{blockHash: string, opReturnHex: string}>} The block hash and OP_RETURN hex.
 * @throws {Error} If TX not found, not confirmed, or missing OP_RETURN.
 */
async function fetchTxDataAndBlockHash(txId) {
  const txApiUrl = `${BLOCKCYPHER_API_BASE_URL}/btc/${BLOCKCYPHER_NETWORK}/txs/${txId}`;
  console.log(`[Utils] Fetching transaction: ${txApiUrl}`);
  try {
    const txResponse = await axios.get(txApiUrl);
    const txData = txResponse.data;

    // Ensure transaction is confirmed
    if (!txData.block_hash || txData.block_height === -1) {
      throw new Error('Transaction is not yet confirmed in a block.');
    }
    const blockHash = txData.block_hash;

    // Extract OP_RETURN data (hex representation of the string CID)
    const opReturnOutputs = txData.outputs.filter(output => output.script_type === 'null-data');
    if (opReturnOutputs.length === 0) {
      throw new Error('Transaction does not contain OP_RETURN data.');
    }
    const opReturnHex = opReturnOutputs[0].data_hex;

    return { blockHash, opReturnHex };

  } catch (error) {
    console.error(`[Utils] Error fetching/processing TX ${txId}:`, error.response?.data || error.message);
    if (error.response && error.response.status === 404) {
      throw new Error('Transaction ID not found.');
    }
    // Re-throw other errors or wrap them
    throw new Error(`Failed to fetch or process transaction details: ${error.message}`);
  }
}

/**
 * Fetches the participant list (CSV) from IPFS using the CID derived from OP_RETURN hex.
 * 
 * @param {string} opReturnHex The hex data from OP_RETURN.
 * @returns {Promise<Array<{name: string, ticket: string}>>} The parsed list of participants.
 * @throws {Error} If decoding fails or IPFS fetch/parse fails.
 */
async function getParticipantsFromOpReturn(opReturnHex) {
  let stringCid;
  try {
    stringCid = Buffer.from(opReturnHex, 'hex').toString('utf8');
    if (!stringCid || (!stringCid.startsWith('b') && !stringCid.startsWith('Q'))) {
       throw new Error('Decoded hex does not look like a standard CID string.');
    }
    console.log(`[Utils] Decoded OP_RETURN hex to string CID: ${stringCid}`);
  } catch (decodeError) {
     console.error(`[Utils] Error decoding OP_RETURN hex: ${opReturnHex}`, decodeError);
     throw new Error(`Failed to decode OP_RETURN data to a valid CID string: ${decodeError.message}`);
  }

  const ipfsUrl = `${PINATA_PUBLIC_GATEWAY_BASE}/${stringCid}`;
  console.log(`[Utils] Fetching participant list from IPFS: ${ipfsUrl}`);
  try {
    const ipfsResponse = await axios.get(ipfsUrl, { responseType: 'text' });
    const csvData = ipfsResponse.data;
    let participants = await csvtojson({ headers: ['name'], noheader: true }).fromString(csvData);
     participants = participants.map((p, i) => ({
       ...p,
       ticket: (i + 1).toString() // Add 1-based ticket number
     }));
    return participants;
  } catch (ipfsError) {
    console.error(`[Utils] Error fetching or parsing CSV from IPFS (${ipfsUrl}):`, ipfsError.response?.data || ipfsError.message);
    const errorDetail = ipfsError.response?.status === 404 ? 'File not found at IPFS URL.' : 'Could not fetch or parse CSV file from IPFS.';
    throw new Error(`Failed to retrieve participant list from IPFS: ${errorDetail}`);
  }
}

/**
 * Generates bingo cards for all participants.
 * 
 * @param {Array<{name: string, ticket: string}>} participants List of participants.
 * @param {string} blockHash The block hash used to derive the base seed.
 * @returns {Array<{cardId: string, lineIndex: number, username: string, grid: object}>} List of generated cards.
 */
function generateAllCards(participants, blockHash) {
  if (!participants || !blockHash) {
    throw new Error('Missing participants or blockHash for card generation.');
  }
  const seedBase = crypto.createHash('sha256').update(blockHash).digest('hex');
  
  const allCards = participants.map((participant, index) => {
    const lineIndex = index; // Use 0-based index for derivation
    const derivedPubKeyBuffer = derivePublicKey(seedBase, lineIndex);
    const card = generateBingoCard(derivedPubKeyBuffer);
    return {
      // Generate a cardId (e.g., from hash of pubkey, consistent with /api/cards)
      cardId: crypto.createHash('sha256').update(derivedPubKeyBuffer).digest('hex').slice(0, 16),
      lineIndex: lineIndex,
      username: participant.name, // Use name from parsed CSV
      grid: card.grid
    };
  });
  console.log(`[Utils] Generated ${allCards.length} cards for blockHash ...${blockHash.slice(-8)}`);
  return allCards;
}

// --- NEW Win Condition Helper ---

/**
 * Calculates the minimum numbers needed to achieve Bingo on a given card grid.
 * Considers rows, columns, and diagonals. Free space (null) counts as marked.
 * 
 * @param {object} grid - The bingo card grid { B: [], I: [], N: [], G: [], O: [] }.
 * @param {number[]} drawnNumbers - Array of numbers drawn so far.
 * @returns {number} Minimum numbers needed to win (0 if Bingo already achieved).
 */
function calculateNumbersNeededToWin(grid, drawnNumbers) {
  if (!grid || !drawnNumbers) return 75; // Return high number if input invalid

  const drawnSet = new Set(drawnNumbers);
  let minNeeded = 5; // Max needed for any single line

  const checkLine = (line) => {
    let markedCount = 0;
    for (const num of line) {
      if (num === null || drawnSet.has(num)) { // Free space or drawn number
        markedCount++;
      }
    }
    const needed = 5 - markedCount;
    minNeeded = Math.min(minNeeded, needed);
  };

  const columns = ['B', 'I', 'N', 'G', 'O'];

  // Check Rows (5)
  for (let i = 0; i < 5; i++) {
    const row = columns.map(col => grid[col][i]);
    checkLine(row);
  }

  // Check Columns (5)
  for (const col of columns) {
    checkLine(grid[col]);
  }

  // Check Diagonals (2)
  const diag1 = [grid.B[0], grid.I[1], grid.N[2], grid.G[3], grid.O[4]];
  checkLine(diag1);
  const diag2 = [grid.B[4], grid.I[3], grid.N[2], grid.G[1], grid.O[0]];
  checkLine(diag2);

  return Math.max(0, minNeeded); // Return 0 if already won
}

// --- End NEW Win Condition Helper ---

const columns = ['B', 'I', 'N', 'G', 'O']; // Define columns for easy access

// --- NEW: Count Marked Numbers (Corrected for Column-Object Grid) ---
function countMarkedNumbers(grid, drawnNumbers) {
    let count = 0;
    const drawnSet = new Set(drawnNumbers);

    if (!grid || !drawnSet) return 0; // Basic validation

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const colLetter = columns[colIndex];
        const columnData = grid[colLetter];
        if (!columnData) continue; // Skip if column data is missing

        for (let rowIndex = 0; rowIndex < columnData.length; rowIndex++) {
            const number = columnData[rowIndex];
            // Check for the Free Space (N column, 3rd element, index 2)
            if (colLetter === 'N' && rowIndex === 2) {
                count++; // Free space always counts
            } else if (number !== null && drawnSet.has(number)) {
                count++;
            }
        }
    }
    return count;
}

// --- NEW: Check for Win Condition (Corrected for Column-Object Grid) ---
// Renamed from checkBingo
function checkWinCondition(grid, drawnNumbers) {
    const drawnSet = new Set(drawnNumbers);
    const size = 5;

    if (!grid || !drawnSet) return false; // Basic validation

    // Helper to check if a cell is marked (handles Free Space)
    const isMarked = (colLetter, rowIndex) => {
        if (colLetter === 'N' && rowIndex === 2) return true; // Free Space
        const number = grid[colLetter]?.[rowIndex];
        return number !== null && number !== undefined && drawnSet.has(number);
    };

    // Check rows
    for (let r = 0; r < size; r++) {
        let rowComplete = true;
        for (let c = 0; c < size; c++) {
            if (!isMarked(columns[c], r)) {
                rowComplete = false;
                break;
            }
        }
        if (rowComplete) return true;
    }

    // Check columns
    for (let c = 0; c < size; c++) {
        let colComplete = true;
        for (let r = 0; r < size; r++) {
            if (!isMarked(columns[c], r)) {
                colComplete = false;
                break;
            }
        }
        if (colComplete) return true;
    }

    // Check diagonals
    let diag1Complete = true; // Top-left to bottom-right
    let diag2Complete = true; // Top-right to bottom-left
    for (let i = 0; i < size; i++) {
        if (!isMarked(columns[i], i)) {
            diag1Complete = false;
        }
        if (!isMarked(columns[i], size - 1 - i)) {
            diag2Complete = false;
        }
    }
    if (diag1Complete || diag2Complete) return true;

    return false;
}

module.exports = {
  derivePublicKey,
  generateBingoCard,
  hashPublicKeyToNumber,
  fetchTxDataAndBlockHash,
  getParticipantsFromOpReturn,
  generateAllCards,
  calculateNumbersNeededToWin,
  countMarkedNumbers,
  checkWinCondition
}; 