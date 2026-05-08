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
// Bitcoin blockchain API providers (tried in order, configurable via BITCOIN_API_ORDER)
const MEMPOOL_API_BASE = process.env.MEMPOOL_API_BASE || 'https://mempool.space/api';
const BLOCKSTREAM_API_BASE = process.env.BLOCKSTREAM_API_BASE || 'https://blockstream.info/api';
const BLOCKCHAIN_INFO_API_BASE = process.env.BLOCKCHAIN_INFO_API_BASE || 'https://blockchain.info';
const BITCOIN_API_TIMEOUT = parseInt(process.env.BITCOIN_API_TIMEOUT || '10000', 10);

/**
 * Derives a BIP32 public key for a given seed hash and index.
 * Uses the path m/44'/0'/0'/0/index.
 * 
 * @param {string} seedHash - The seed hash (e.g., previous block hash) in hex format.
 * @param {number} index - The derivation index (e.g., 1-based line number).
 * @returns {Buffer} The derived public key.
 */
function derivePublicKey(seedHash, index) {
  if (!seedHash || typeof seedHash !== 'string' || !/^[0-9a-fA-F]+$/.test(seedHash) || seedHash.length < 32) { // Basic hex check & minimum length (128 bits / 4 bits/hex = 32 chars)
    throw new Error(`Invalid seedHash provided for key derivation: Must be a non-empty hex string of at least 32 characters.`);
  }
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) { 
    throw new Error(`Invalid index provided for key derivation: Must be a non-negative integer. Received: ${index}`);
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

  const publicKeyHex = publicKey.toString('hex'); // Get hex string representation
  console.log(`[DEBUG] generateBingoCard: publicKeyHex = ${publicKeyHex}`);
  const cardId = `card-${publicKeyHex.slice(-8)}`; // Use last 8 hex digits as a simple ID
  const grid = { B: [], I: [], N: [], G: [], O: [] };
  const ranges = {
    B: { min: 1, max: 15, size: 15 },
    I: { min: 16, max: 30, size: 15 },
    N: { min: 31, max: 45, size: 15 },
    G: { min: 46, max: 60, size: 15 },
    O: { min: 61, max: 75, size: 15 },
  };

  // Hash the HEX STRING representation of the public key
  let hash = crypto.createHash('sha256').update(publicKeyHex).digest();
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

  console.log(`Generated card grid for pubKey ending in ...${publicKeyHex.slice(-8)}`);
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
    // No SHA256 hash needed here anymore
    // const hash = crypto.createHash('sha256').update(publicKey).digest();

    // Take the last 4 bytes (8 hex digits) of the RAW public key buffer
    if (publicKey.length < 4) {
        // This should not happen with standard secp256k1 keys (33 or 65 bytes)
        throw new Error('Public key buffer is too short.');
    }
    const last4Bytes = publicKey.slice(-4);
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

// --- Bitcoin Blockchain API Providers ---

/**
 * Parses OP_RETURN data hex from a scriptpubkey hex string.
 * Handles both BlockCypher format (raw data_hex) and
 * mempool/blockstream format (6a + pushdata length + data).
 *
 * @param {string} scriptpubkeyHex - The scriptpubkey in hex.
 * @returns {string} The OP_RETURN data as hex.
 */
function parseOpReturnHex(scriptpubkeyHex) {
  if (!scriptpubkeyHex || typeof scriptpubkeyHex !== 'string') {
    throw new Error('Invalid scriptpubkey hex.');
  }
  // BlockCypher/raw format: data already starts with the content (no 6a prefix)
  if (!scriptpubkeyHex.startsWith('6a')) {
    return scriptpubkeyHex;
  }
  // mempool/blockstream/blockchain.info format: 6a + pushdata_byte + data
  // 6a = OP_RETURN, followed by 1-byte length (for data <= 75 bytes)
  // or OP_PUSHDATA1 (4c) + 1-byte length, or OP_PUSHDATA2 (4d) + 2-byte length
  const hexAfterOpReturn = scriptpubkeyHex.slice(2); // strip '6a'
  const firstByte = parseInt(hexAfterOpReturn.slice(0, 2), 16);

  if (firstByte <= 75) {
    // Direct push: next byte is length
    return hexAfterOpReturn.slice(2);
  } else if (firstByte === 0x4c) {
    // OP_PUSHDATA1: next byte is length
    const len = parseInt(hexAfterOpReturn.slice(2, 4), 16);
    return hexAfterOpReturn.slice(4, 4 + len * 2);
  } else if (firstByte === 0x4d) {
    // OP_PUSHDATA2: next 2 bytes are length (LE)
    const len = parseInt(hexAfterOpReturn.slice(4, 6) + hexAfterOpReturn.slice(2, 4), 16);
    return hexAfterOpReturn.slice(6, 6 + len * 2);
  }
  throw new Error(`Cannot parse OP_RETURN pushdata: unexpected first byte 0x${firstByte.toString(16)}`);
}

/**
 * Fetches transaction data from mempool.space API.
 * Free, no API key required.
 *
 * @param {string} txId
 * @returns {Promise<{blockHash: string, opReturnHex: string}>}
 */
async function fetchTxFromMempool(txId) {
  const url = `${MEMPOOL_API_BASE}/tx/${txId}`;
  console.log(`[Mempool] Fetching: ${url}`);
  const response = await axios.get(url, { timeout: BITCOIN_API_TIMEOUT });
  const data = response.data;

  if (!data.status || !data.status.confirmed) {
    throw new Error('Transaction not yet confirmed in a block (mempool).');
  }
  const blockHash = data.status.block_hash;

  // Find OP_RETURN output
  const opReturnVout = data.vout.find(o => o.scriptpubkey_type === 'op_return');
  if (!opReturnVout) {
    throw new Error('Transaction does not contain OP_RETURN data (mempool).');
  }
  const opReturnHex = parseOpReturnHex(opReturnVout.scriptpubkey);

  return { blockHash, opReturnHex };
}

/**
 * Fetches transaction data from blockstream.info (esplora) API.
 * Free, no API key required.
 *
 * @param {string} txId
 * @returns {Promise<{blockHash: string, opReturnHex: string}>}
 */
async function fetchTxFromBlockstream(txId) {
  const url = `${BLOCKSTREAM_API_BASE}/tx/${txId}`;
  console.log(`[Blockstream] Fetching: ${url}`);
  const response = await axios.get(url, { timeout: BITCOIN_API_TIMEOUT });
  const data = response.data;

  if (!data.status || !data.status.confirmed) {
    throw new Error('Transaction not yet confirmed in a block (blockstream).');
  }
  const blockHash = data.status.block_hash;

  const opReturnVout = data.vout.find(o => o.scriptpubkey_type === 'op_return');
  if (!opReturnVout) {
    throw new Error('Transaction does not contain OP_RETURN data (blockstream).');
  }
  const opReturnHex = parseOpReturnHex(opReturnVout.scriptpubkey);

  return { blockHash, opReturnHex };
}

/**
 * Fetches transaction data from blockchain.info API.
 * Requires 2 calls: tx (for block_height + OP_RETURN) → block (for block_hash).
 * Free, no API key required. Different backend from mempool/blockstream.
 *
 * @param {string} txId
 * @returns {Promise<{blockHash: string, opReturnHex: string}>}
 */
async function fetchTxFromBlockchainInfo(txId) {
  // Step 1: Fetch transaction
  const txUrl = `${BLOCKCHAIN_INFO_API_BASE}/rawtx/${txId}`;
  console.log(`[BlockchainInfo] Fetching tx: ${txUrl}`);
  const txResponse = await axios.get(txUrl, { timeout: BITCOIN_API_TIMEOUT });
  const txData = txResponse.data;

  if (!txData.block_height || txData.block_height <= 0) {
    throw new Error('Transaction not yet confirmed in a block (blockchain.info).');
  }

  // Find OP_RETURN output
  const opReturnOut = txData.out.find(o => o.type === 0 && o.script && o.script.startsWith('6a'));
  if (!opReturnOut) {
    throw new Error('Transaction does not contain OP_RETURN data (blockchain.info).');
  }
  const opReturnHex = parseOpReturnHex(opReturnOut.script);

  // Step 2: Fetch block to get the block hash
  const blockUrl = `${BLOCKCHAIN_INFO_API_BASE}/rawblock/${txData.block_height}`;
  console.log(`[BlockchainInfo] Fetching block: ${blockUrl}`);
  const blockResponse = await axios.get(blockUrl, { timeout: BITCOIN_API_TIMEOUT });
  const blockData = blockResponse.data;

  if (!blockData.hash) {
    throw new Error('Failed to retrieve block hash from blockchain.info.');
  }

  return { blockHash: blockData.hash, opReturnHex };
}

/**
 * Fetches transaction data from Bitcoin blockchain, extracts block hash and OP_RETURN.
 * Tries multiple providers in order (configurable via BITCOIN_API_ORDER env var).
 * Default order: mempool, blockstream, blockchain_info
 *
 * @param {string} txId The transaction ID.
 * @returns {Promise<{blockHash: string, opReturnHex: string}>} The block hash and OP_RETURN hex.
 * @throws {Error} If all providers fail, TX not confirmed, or missing OP_RETURN.
 */
async function fetchTxDataAndBlockHash(txId) {
  // Provider order: configurable via BITCOIN_API_ORDER env var
  const providerOrder = (process.env.BITCOIN_API_ORDER || 'mempool,blockstream,blockchain_info')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const providers = {
    mempool: fetchTxFromMempool,
    blockstream: fetchTxFromBlockstream,
    blockchain_info: fetchTxFromBlockchainInfo,
  };

  // Collect errors for meaningful reporting
  const errors = [];

  for (const name of providerOrder) {
    const fn = providers[name];
    if (!fn) {
      console.warn(`[Utils] Unknown Bitcoin API provider: ${name}, skipping.`);
      continue;
    }

    try {
      console.log(`[Utils] Trying provider: ${name}`);
      const result = await fn(txId);
      console.log(`[Utils] Success via ${name}: blockHash=${result.blockHash.slice(0, 16)}...`);
      return result;
    } catch (err) {
      const msg = `${name}: ${err.response?.status || ''} ${err.message}`;
      console.warn(`[Utils] Provider ${name} failed: ${msg}`);
      errors.push(msg);
    }
  }

  // All providers failed — throw with details
  const detail = errors.map(e => `  - ${e}`).join('\n');
  throw new Error(`Failed to fetch transaction ${txId} from all providers:\n${detail}`);
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
    let participants = await csvtojson({ 
        output: "json"
    }).fromString(csvData);
    participants = standardizeParticipantObject(participants);
    participants = participants.map((p, i) => ({
      ...p,
      ticket: (i + 1).toString() // Add 1-based ticket number
    }));
    console.log(`[Utils] Successfully parsed ${participants.length} participants after handling header.`);
    return participants;
  } catch (ipfsError) {
    console.error(`[Utils] Error fetching or parsing CSV from IPFS (${ipfsUrl}):`, ipfsError.response?.data || ipfsError.message);
    const errorDetail = ipfsError.response?.status === 404 ? 'File not found at IPFS URL.' : 'Could not fetch or parse CSV file from IPFS.';
    throw new Error(`Failed to retrieve participant list from IPFS: ${errorDetail}`);
  }
}

/**
 * Standardizes participant objects to ensure they have a consistent format with a 'name' property.
 * Takes the first property value from each participant object and assigns it as the name.
 * 
 * @param {Array<Object>} participants - Array of participant objects from CSV parsing.
 * @returns {Array<{name: string}>} Array of standardized participant objects with name property.
 */
function standardizeParticipantObject(participants) {
  return participants.map(participant => ({
    name: participant[Object.keys(participant)[0]]
  }));
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
    const finalCardObject = { // Explicitly create the object
        cardId: card.cardId,
        lineIndex: lineIndex,
        username: participant.name, // Use name from parsed CSV
        grid: card.grid
    };
    // --- ADDING DEBUG LOG --- 
    console.log(`[DEBUG] generateAllCards: Storing Card for index ${index} (${participant.name}) with cardId: ${finalCardObject.cardId}`);
    // --- END DEBUG LOG ---
    return finalCardObject; // Return the created object
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

// --- NEW: Count Marked DRAWN Numbers (Excludes Free Space) ---
// Added for clearer statistics display
function countMarkedDrawnNumbers(grid, drawnNumbers) {
    let count = 0;
    const drawnSet = new Set(drawnNumbers);

    if (!grid || !drawnSet) return 0; // Basic validation

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const colLetter = columns[colIndex];
        const columnData = grid[colLetter];
        if (!columnData) continue; // Skip if column data is missing

        for (let rowIndex = 0; rowIndex < columnData.length; rowIndex++) {
            const number = columnData[rowIndex];
            // ONLY count if the number is in the drawn set (exclude free space implicitly)
            if (number !== null && drawnSet.has(number)) {
                count++;
            }
        }
    }
    return count;
}

// --- NEW: Calculate Max Marked Squares in Any Line (Row, Col, Diag) ---
// Includes the FREE space. Useful for showing proximity to winning.
function calculateMaxMarkedInLine(grid, drawnNumbers) {
    // Improved check for valid grid structure and drawnNumbers
    const columns = ['B', 'I', 'N', 'G', 'O'];
    const isValidGrid = grid && typeof grid === 'object' && columns.every(col => Array.isArray(grid[col]) && grid[col].length === 5);
    if (!isValidGrid || drawnNumbers == null) {
        return 0;
    }

    const drawnSet = new Set(drawnNumbers);
    const size = 5;
    let maxMarked = 0;

    // Helper to check if a cell is marked (handles Free Space)
    const isMarked = (colLetter, rowIndex) => {
        if (colLetter === 'N' && rowIndex === 2) return true; // Free Space
        const number = grid[colLetter]?.[rowIndex];
        return number !== null && number !== undefined && drawnSet.has(number);
    };

    // Check rows
    for (let r = 0; r < size; r++) {
        let currentMarked = 0;
        for (let c = 0; c < size; c++) {
            if (isMarked(columns[c], r)) {
                currentMarked++;
            }
        }
        maxMarked = Math.max(maxMarked, currentMarked);
    }

    // Check columns
    for (let c = 0; c < size; c++) {
        let currentMarked = 0;
        for (let r = 0; r < size; r++) {
            if (isMarked(columns[c], r)) {
                currentMarked++;
            }
        }
        maxMarked = Math.max(maxMarked, currentMarked);
    }

    // Check diagonal 1 (Top-left to bottom-right)
    let diag1Marked = 0;
    for (let i = 0; i < size; i++) {
        if (isMarked(columns[i], i)) {
            diag1Marked++;
        }
    }
    maxMarked = Math.max(maxMarked, diag1Marked);

    // Check diagonal 2 (Top-right to bottom-left)
    let diag2Marked = 0;
    for (let i = 0; i < size; i++) {
        if (isMarked(columns[i], size - 1 - i)) {
            diag2Marked++;
        }
    }
    maxMarked = Math.max(maxMarked, diag2Marked);

    return maxMarked;
}

// --- NEW: Check for Win Condition (Corrected for Column-Object Grid) ---
// Renamed from checkBingo
/**
 * Checks if a bingo card has achieved a win (horizontal, vertical, or diagonal line).
 * Includes the free space.
 * 
 * @param {object} grid - The bingo card grid.
 * @param {Set<number>} drawnNumbersSet - A Set containing the numbers drawn so far.
 * @returns {Array<number|null>|null} The winning line (sequence of numbers/null) if a win exists, otherwise null.
 */
function checkLineWin(grid, drawnNumbersSet) {
  // --- Refined Guard Clause --- //
  const isValidGrid = grid && 
                      typeof grid === 'object' && 
                      Array.isArray(grid.B) && grid.B.length === 5 &&
                      Array.isArray(grid.I) && grid.I.length === 5 &&
                      Array.isArray(grid.N) && grid.N.length === 5 &&
                      Array.isArray(grid.G) && grid.G.length === 5 &&
                      Array.isArray(grid.O) && grid.O.length === 5;

  if (!isValidGrid || !drawnNumbersSet || !(drawnNumbersSet instanceof Set)) {
    console.warn('[Win Check] Invalid input provided to checkLineWin (Grid structure or Set invalid).');
    return null;
  }
  // --- End Guard Clause ---

  console.log(`[Win Check] Checking for line win... Drawn count: ${drawnNumbersSet.size}`);

  const B = grid.B;
  const I = grid.I;
  const N = grid.N;
  const G = grid.G;
  const O = grid.O;
  const columns = [B, I, N, G, O]; // Array of column arrays

  // Check rows
  for (let i = 0; i < 5; i++) {
    const row = [B[i], I[i], N[i], G[i], O[i]];
    if (row.every(num => num === null || drawnNumbersSet.has(num))) {
      return row;
    }
  }

  // Check columns
  for (const column of columns) {
    if (column.every(num => num === null || drawnNumbersSet.has(num))) {
      return column;
    }
  }

  // Check diagonals
  const diag1 = [B[0], I[1], N[2], G[3], O[4]];
  const diag2 = [B[4], I[3], N[2], G[1], O[0]];
  if (diag1.every(num => num === null || drawnNumbersSet.has(num))) {
    return diag1;
  }
  if (diag2.every(num => num === null || drawnNumbersSet.has(num))) {
    return diag2;
  }

  return null; // No win found
}

/**
 * Checks if a bingo card has achieved a full card win (all 24 non-free numbers marked).
 * 
 * @param {object} grid - The bingo card grid.
 * @param {Set<number>} drawnNumbersSet - A Set containing the numbers drawn so far.
 * @returns {boolean} True if all numbers on the card (excluding free space) are in drawnNumbersSet, false otherwise.
 */
function checkFullCardWin(grid, drawnNumbersSet) {
  console.log(`[Win Check] Checking for full card win... Drawn count: ${drawnNumbersSet.size}`);
  if (drawnNumbersSet.size < 24) {
    // Optimization: Impossible to have a full card win with fewer than 24 numbers drawn.
    return false;
  }

  for (const colLetter of ['B', 'I', 'N', 'G', 'O']) {
    const column = grid[colLetter];
    for (let i = 0; i < column.length; i++) {
      const number = column[i];
      // Skip the free space (N[2] is null)
      if (number === null) continue;
      
      // If any non-null number is *not* in the drawn set, it's not a full card win.
      if (!drawnNumbersSet.has(number)) {
        return false;
      }
    }
  }

  // If we looped through all columns and all numbers (except null) were found in the set, it's a win.
  console.log(`[Win Check] Full card win confirmed!`);
  return true;
}

module.exports = {
  derivePublicKey,
  generateBingoCard,
  hashPublicKeyToNumber,
  fetchTxDataAndBlockHash,
  fetchTxFromMempool,
  fetchTxFromBlockstream,
  fetchTxFromBlockchainInfo,
  parseOpReturnHex,
  getParticipantsFromOpReturn,
  generateAllCards,
  calculateNumbersNeededToWin,
  countMarkedNumbers,
  countMarkedDrawnNumbers,
  calculateMaxMarkedInLine,
  checkLineWin,
  checkFullCardWin,
  standardizeParticipantObject
}; 