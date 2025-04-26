const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const csvtojson = require('csvtojson');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const bip32 = require('@scure/bip32');
const ecc = require('tiny-secp256k1')
const { BIP32Factory } = require('bip32')
require('dotenv').config();
const bs58 = require('bs58');
const CID = require('cids');
const { derivePublicKey, generateBingoCard } = require('./utils'); // Import helper functions
const app = express();
const port = process.env.PORT || 5000;

// --- BEGIN Add Cache ---
// In-memory cache for game session data (keyed by txId)
const gameSessionCache = new Map();
// --- END Add Cache ---

const network_version = {
  mainnet: {
    private: 0x04b2430c,
    public: 0x04b24746,
  },
  testnet: {
    private: 0x045f18bc,
    public: 0x045f1cf6,
  },
};


// Pinata configuration
const PINATA_JWT = process.env.PINATA_JWT_KEY;
const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';
// Use environment variable for public gateway, fallback to a default
const PINATA_PUBLIC_GATEWAY_BASE = process.env.PINATA_PUBLIC_GATEWAY_BASE || 'https://ipfs.io/ipfs';
// Use environment variable for BlockCypher API base, fallback to default
const BLOCKCYPHER_API_BASE_URL = process.env.BLOCKCYPHER_API_BASE_URL || 'https://api.blockcypher.com/v1';

// Setup middleware
app.use(cors());
app.use(express.json());

// Setup file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to upload file to Pinata
async function uploadToPinata(filePath, fileName) {
  try {
    const fileStream = fs.createReadStream(filePath);

    const formData = new FormData();
    formData.append('file', fileStream);
    formData.append('name', fileName);
    formData.append('network', 'public');

    const response = await axios.post(PINATA_UPLOAD_URL, formData, {
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('Pinata upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading to Pinata:', error.response?.data || error.message);
    throw error;
  }
}

// Global state
let currentRaffle = {
  filePath: null,
  fileHash: null,
  txId: null,
  blockHash: null,
  participants: [],
  winner: null,
  ipfsHash: null
};

// Upload CSV endpoint
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate CSV file
    const filePath = req.file.path;
    const participants = await csvtojson().fromFile(filePath);

    if (participants.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    // Make sure each participant has a valid name
    for (let i = 0; i < participants.length; i++) {
      if (!participants[i].name) {
        // If participant has no name property, check if there's another property we can use
        const keys = Object.keys(participants[i]);
        if (keys.length > 0) {
          participants[i].name = participants[i][keys[0]];
        } else {
          participants[i].name = `Participant ${i + 1}`;
        }
      }
      // Add a ticket number for display purposes
      participants[i].ticket = (i + 1).toString();
    }

    // Initialize raffle state without hash
    currentRaffle = {
      filePath,
      fileHash: null,
      participants,
      txId: null,
      blockHash: null,
      winner: null,
      ipfsHash: null
    };

    // Store file on IPFS via Pinata
    try {
      const fileName = path.basename(filePath);

      // Upload to Pinata and get CID
      const response = await uploadToPinata(filePath, fileName);
      console.log('Pinata upload response:', response);

      // Get the CID from the response
      const cid = response.data.cid;
      currentRaffle.ipfsHash = cid;

      // Convert CID to hex for external reference
      const hexCID = Buffer.from(cid).toString('hex');
      currentRaffle.fileHash = hexCID;

      // Return success with file info and gateway URL
      // Use the configured public gateway base URL
      const publicUrl = `${PINATA_PUBLIC_GATEWAY_BASE}/${cid}`;

      res.json({
        status: 'success',
        fileHash: currentRaffle.fileHash,
        participantCount: participants.length,
        ipfsHash: currentRaffle.ipfsHash,
        publicUrl: publicUrl
      });
    } catch (ipfsError) {
      console.error('IPFS upload error:', ipfsError);
      // Return an error response to the client since IPFS storage is required
      res.status(500).json({
        error: 'Failed to store the file on IPFS via Pinata. Please try again.',
        details: ipfsError.message
      });
    }
  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ error: 'Server error during file upload' });
  }
});

// Get CID in hex format
app.get('/api/get-hex-cid', (req, res) => {
  if (!currentRaffle.ipfsHash || !currentRaffle.fileHash) {
    return res.status(400).json({ error: 'No file has been uploaded yet' });
  }

  res.json({
    status: 'success',
    ipfsHash: currentRaffle.ipfsHash,
    hexCID: currentRaffle.fileHash
  });
});

// Submit transaction ID
app.post('/api/submit-transaction', async (req, res) => {
  try {
    const { txId } = req.body;

    if (!txId) {
      return res.status(400).json({ error: 'No transaction ID provided' });
    }

    if (!currentRaffle.fileHash) {
      return res.status(400).json({ error: 'No file has been uploaded yet' });
    }

    // Save the transaction ID
    currentRaffle.txId = txId;

    res.json({
      status: 'success',
      txId: txId,
      message: 'Transaction ID submitted successfully. Monitoring for confirmation.'
    });
  } catch (error) {
    console.error('Error submitting transaction ID:', error);
    res.status(500).json({
      error: 'Server error while submitting transaction ID',
      details: error.message
    });
  }
});

// Check transaction status and get block hash
app.get('/api/check-transaction', async (req, res) => {
  try {
    if (!currentRaffle.txId) {
      return res.status(400).json({ error: 'No transaction ID has been submitted yet' });
    }

    if (!currentRaffle.fileHash) {
      return res.status(400).json({ error: 'No file hash available to verify' });
    }

    try {
      const txId = currentRaffle.txId;
      const network = process.env.BLOCKCYPHER_NETWORK || 'main';
      const txApiUrl = `${BLOCKCYPHER_API_BASE_URL}/btc/${network}/txs/${txId}`;

      console.log(`Checking transaction status from: ${txApiUrl}`);
      const response = await axios.get(txApiUrl);
      const txData = response.data;

      // Verify OP_RETURN data matches our expected hex CID
      // currentRaffle.fileHash stores the hex representation of the string CID
      const opReturnOutputs = txData.outputs.filter(output => output.script_type === 'null-data');
      const opReturnDataHex = opReturnOutputs.length > 0 ? opReturnOutputs[0].data_hex : null;

      // Compare the raw hex data found with the expected hex representation of the CID string
      if (opReturnDataHex !== currentRaffle.fileHash) {
        console.error(`OP_RETURN mismatch: Expected ${currentRaffle.fileHash}, Found ${opReturnDataHex}`);
        return res.status(400).json({
          error: 'Transaction does not contain the correct IPFS hash hex in OP_RETURN',
          status: 'invalid'
        });
      }

      // Check confirmation status
      if (txData.block_height && txData.block_height !== -1) {
        // Transaction is confirmed
        currentRaffle.blockHash = txData.block_hash; // Store the current block hash
        res.json({
          status: 'success',
          txId: currentRaffle.txId,
          blockHash: currentRaffle.blockHash,
          confirmed: true,
          confirmations: txData.confirmations || 1
        });
      } else {
        // Transaction is pending
        res.json({
          status: 'pending',
          txId: currentRaffle.txId,
          confirmed: false,
          message: 'Transaction found but not yet confirmed'
        });
      }
    } catch (error) {
      console.error('Error checking transaction via API:', error.response?.data || error.message);

      // If we get a 404, the transaction doesn't exist (yet)
      if (error.response && error.response.status === 404) {
        res.json({
          status: 'not_found',
          txId: currentRaffle.txId,
          confirmed: false,
          message: 'Transaction ID not found on the blockchain yet. It may still be propagating.'
        });
      } else {
        // For other API errors, return the error details
        res.status(500).json({
          error: 'Failed to check transaction status',
          details: error.response?.data || error.message
        });
      }
    }
  } catch (error) {
    console.error('Error checking transaction:', error);
    res.status(500).json({ error: 'Server error while checking transaction' });
  }
});

function uint8ArrayToBigInt(bytes) {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}
// Calculate winner from block hash
app.get('/api/calculate-winner', async (req, res) => {
  try {

    // Step 2: Generate mnemonic
    console.log("blockHash:", currentRaffle.blockHash)
    const bip32 = BIP32Factory(ecc)
    const root = bip32.fromSeed(Buffer.from(currentRaffle.blockHash, 'hex'))
    if (!currentRaffle.blockHash || !currentRaffle.participants) {
      return res.status(400).json({ error: 'Missing block hash or participant data' });
    }

    let winnerCount = parseInt(req?.query?.winnerCount)

    if (winnerCount < 1) {
      winnerCount = 1
    }

    const blockHash = currentRaffle.blockHash;
    const participantCount = currentRaffle.participants.length;

    if (winnerCount + 1 > participantCount) {
      winnerCount = participantCount - 1
    }

    currentRaffle.winner = []
    let winnersArr = []
    let pathIndex = 0
    for (let i = 0; i < winnerCount; i++) {
      let derivationPath = `m/44'/0'/0'/0/${pathIndex}`
      let child = root.derivePath(derivationPath);
      let numericValue = uint8ArrayToBigInt(child.publicKey)
      pathIndex++
      let winnerIndex = parseInt(numericValue.toString(16).slice(-8), 16) % participantCount;
      let winner = currentRaffle.participants[winnerIndex];
      if (winner && typeof winner === 'object') {
        if (!winner.name) {
          winner.name = `Participant ${winnerIndex}`;
        }
        if (!winner.ticket) {
          winner.ticket = (winnerIndex).toString();
        }
      }
      while (winnersArr.indexOf(winner.name) > -1) {
        pathIndex++
        derivationPath = `m/44'/0'/0'/0/${pathIndex}`
        child = root.derivePath(derivationPath)
        numericValue = uint8ArrayToBigInt(child.publicKey)
        winnerIndex = parseInt(numericValue.toString(16).slice(-8), 16) % participantCount;
        winner = currentRaffle.participants[winnerIndex]
      }
      winner.hashPart = numericValue.toString(16)
      winner.derivationPath = derivationPath
      winnersArr.push(winner.name)
      currentRaffle.winner.push(winner);
    }

    console.log(currentRaffle.winner)

    res.json({
      status: 'success',
      blockHash,
      winner: currentRaffle.winner,
      calculation: {
        blockHash,
        participantCount,
      }
    });
  } catch (error) {
    console.error('Error calculating winner:', error);
    res.status(500).json({ error: 'Server error while calculating winner' });
  }
});

// Get current raffle status
app.get('/api/status', (req, res) => {
  res.json({
    fileUploaded: !!currentRaffle.filePath,
    fileHash: currentRaffle.fileHash,
    participantCount: currentRaffle.participants.length,
    txId: currentRaffle.txId,
    txConfirmed: !!currentRaffle.blockHash,
    blockHash: currentRaffle.blockHash,
    winner: currentRaffle.winner,
    ipfsHash: currentRaffle.ipfsHash
  });
});

// Reset raffle state
app.post('/api/reset', (req, res) => {
  try {
    // Reset the current raffle state
    currentRaffle = {
      filePath: null,
      fileHash: null,
      txId: null,
      blockHash: null,
      participants: [],
      winner: null,
      ipfsHash: null
    };

    res.json({
      status: 'success',
      message: 'Raffle state reset successfully'
    });
  } catch (error) {
    console.error('Error resetting raffle state:', error);
    res.status(500).json({ error: 'Server error while resetting raffle state' });
  }
});

// Get block hash by block number
app.get('/api/block-hash/:blockNumber', async (req, res) => {
  try {
    const { blockNumber } = req.params;
    if (!blockNumber || isNaN(Number(blockNumber))) {
      return res.status(400).json({ error: 'Invalid or missing block number' });
    }
    const network = process.env.BLOCKCYPHER_NETWORK || 'main';
    const blockApiUrl = `${BLOCKCYPHER_API_BASE_URL}/btc/${network}/blocks/${blockNumber}`;
    try {
      const response = await axios.get(blockApiUrl);
      const blockHash = response.data.hash;
      if (!blockHash) {
        return res.status(404).json({ error: 'Block hash not found for this block number' });
      }
      res.json({
        status: 'success',
        blockNumber: Number(blockNumber),
        blockHash
      });
    } catch (apiError) {
      console.error('Error fetching block from BlockCypher:', apiError.response?.data || apiError.message || apiError);
      if (apiError.response && apiError.response.status === 404) {
        res.status(404).json({ error: 'Block not found on the blockchain' });
      } else {
        res.status(500).json({
          error: 'Failed to fetch block hash',
          details: apiError.response?.data || apiError.message || apiError.toString()
        });
      }
    }
  } catch (error) {
    console.error('Error in /api/block-hash/:blockNumber:', error);
    res.status(500).json({ error: 'Server error while fetching block hash' });
  }
});

// Endpoint to get block hash by block number
app.get('/api/block/:blockNumber', async (req, res) => {
  try {
    const { blockNumber } = req.params;

    if (!blockNumber || isNaN(parseInt(blockNumber))) {
      return res.status(400).json({ error: 'Valid block number is required' });
    }

    const network = process.env.BLOCKCYPHER_NETWORK || 'main';
    // Use the configured BlockCypher base URL
    const blockApiUrl = `${BLOCKCYPHER_API_BASE_URL}/btc/${network}/blocks/${blockNumber}`;

    console.log(`Fetching block details from: ${blockApiUrl}`);
    const response = await axios.get(blockApiUrl);

    if (response.data && response.data.hash) {
      res.json({
        status: 'success',
        blockNumber: parseInt(blockNumber),
        blockHash: response.data.hash
      });
    } else {
      // Handle cases where the block might exist but the response format is unexpected
      console.error('Unexpected response format from BlockCypher:', response.data);
      res.status(404).json({ error: 'Block found, but hash could not be retrieved', status: 'error' });
    }
  } catch (error) {
    console.error('Error fetching block hash:', error.response?.data || error.message);
    if (error.response && error.response.status === 404) {
      res.status(404).json({ error: 'Block not found', status: 'not_found' });
    } else {
      res.status(500).json({
        error: 'Server error while fetching block hash',
        details: error.message,
        status: 'error'
      });
    }
  }
});

// --- Helper Functions (Placeholder implementations or to be moved) ---
// REMOVED FROM HERE
// --- End Helper Functions ---

// --- NEW: Generate Bingo Cards Endpoint --- 
app.get('/api/cards', async (req, res) => {
  const { txId, nickname } = req.query;

  if (!txId) {
    return res.status(400).json({ error: 'Transaction ID (txId) is required' });
  }
  if (!nickname) {
    return res.status(400).json({ error: 'Nickname is required' });
  }

  try {
    // --- BEGIN Check Cache ---
    if (gameSessionCache.has(txId)) {
      console.log(`Cache hit for txId: ${txId}`);
      const cachedData = gameSessionCache.get(txId);
      const { blockHash, participants } = cachedData;

      // Find user lines and generate cards using cached data
      const userLines = participants
        .map((p, index) => ({ ...p, lineIndex: index })) // Add original line index
        .filter(p => p.name && p.name.trim().toLowerCase() === nickname.trim().toLowerCase());

      if (userLines.length === 0) {
        return res.status(404).json({ error: `Nickname '${nickname}' not found in the participant list for this transaction.` });
      }

      // Use CURRENT block hash for seed base
      const seedBase = crypto.createHash('sha256').update(blockHash).digest('hex');

      const userCards = userLines.map(user => {
        const derivedPubKeyBuffer = derivePublicKey(seedBase, user.lineIndex);
        const card = generateBingoCard(derivedPubKeyBuffer);
        return {
          cardId: crypto.createHash('sha256').update(derivedPubKeyBuffer).digest('hex').slice(0, 16),
          lineIndex: user.lineIndex,
          username: user.name,
          grid: card.grid
        };
      });

      return res.json({ status: 'success', cards: userCards, blockHash: blockHash });

    }
    // --- END Check Cache ---

    console.log(`Cache miss for txId: ${txId}. Fetching from APIs.`);

    // Fetch transaction details if not in cache
    const network = process.env.BLOCKCYPHER_NETWORK || 'main';
    const txApiUrl = `${BLOCKCYPHER_API_BASE_URL}/btc/${network}/txs/${txId}`;
    console.log(`Fetching transaction: ${txApiUrl}`);
    const txResponse = await axios.get(txApiUrl);
    const txData = txResponse.data;

    // Ensure transaction is confirmed
    if (!txData.block_hash || txData.block_height === -1) {
      return res.status(400).json({ error: 'Transaction is not yet confirmed in a block.' });
    }
    const currentBlockHash = txData.block_hash;

    // Extract OP_RETURN data (hex representation of the string CID)
    const opReturnOutputs = txData.outputs.filter(output => output.script_type === 'null-data');
    if (opReturnOutputs.length === 0) {
      return res.status(400).json({ error: 'Transaction does not contain OP_RETURN data.' });
    }
    const opReturnDataHex = opReturnOutputs[0].data_hex;

    // --- BEGIN Fix CID Handling ---
    // Convert the HEX data back to the original STRING CID
    let stringCid;
    try {
      stringCid = Buffer.from(opReturnDataHex, 'hex').toString('utf8');
      // Basic validation if it looks like a CID (starts with 'b' or 'Q')
      if (!stringCid || (!stringCid.startsWith('b') && !stringCid.startsWith('Q'))) {
         throw new Error('Decoded hex does not look like a standard CID string.');
      }
      console.log(`Decoded OP_RETURN hex to string CID: ${stringCid}`);
    } catch (decodeError) {
       console.error(`Error decoding OP_RETURN hex: ${opReturnDataHex}`, decodeError);
       return res.status(500).json({ error: 'Failed to decode OP_RETURN data to a valid CID string.', details: decodeError.message });
    }
    // --- END Fix CID Handling ---

    // --- BEGIN Fetch IPFS Data ---
    const ipfsUrl = `${PINATA_PUBLIC_GATEWAY_BASE}/${stringCid}`;
    console.log(`Fetching participant list from IPFS: ${ipfsUrl}`);
    let participants = [];
    try {
      const ipfsResponse = await axios.get(ipfsUrl, { responseType: 'text' });
      const csvData = ipfsResponse.data;
      participants = await csvtojson({ headers: ['name'], noheader: true }).fromString(csvData);
       // Add ticket number for display purposes during parsing
       participants = participants.map((p, i) => ({
         ...p,
         ticket: (i + 1).toString()
       }));
    } catch (ipfsError) {
      console.error(`Error fetching or parsing CSV from IPFS (${ipfsUrl}):`, ipfsError.response?.data || ipfsError.message);
      // Distinguish between fetch error and parse error if possible
      const errorDetail = ipfsError.response?.status === 404 ? 'File not found at IPFS URL.' : 'Could not fetch or parse CSV file from IPFS.';
      return res.status(500).json({ error: 'Failed to retrieve participant list from IPFS.', details: errorDetail });
    }
     // --- END Fetch IPFS Data ---

    // --- BEGIN Store in Cache ---
    const cacheData = {
      blockHash: currentBlockHash,
      participants: participants // Store the parsed participant list
    };
    gameSessionCache.set(txId, cacheData);
    console.log(`Stored data in cache for txId: ${txId}`);
    // --- END Store in Cache ---

    // Find user lines and generate cards (same logic as cache hit)
    const userLines = participants
      .map((p, index) => ({ ...p, lineIndex: index })) // Add original line index
      .filter(p => p.name && p.name.trim().toLowerCase() === nickname.trim().toLowerCase());

    if (userLines.length === 0) {
      return res.status(404).json({ error: `Nickname '${nickname}' not found in the participant list.` });
    }

    // --- BEGIN Use Current Block Hash for Seed ---
    // Use CURRENT block hash for seed base
    const seedBase = crypto.createHash('sha256').update(currentBlockHash).digest('hex');
    // --- END Use Current Block Hash for Seed ---

    const userCards = userLines.map(user => {
      const derivedPubKeyBuffer = derivePublicKey(seedBase, user.lineIndex);
      const card = generateBingoCard(derivedPubKeyBuffer);
      return {
        cardId: crypto.createHash('sha256').update(derivedPubKeyBuffer).digest('hex').slice(0, 16),
        lineIndex: user.lineIndex,
        username: user.name,
        grid: card.grid
      };
    });

    res.json({ status: 'success', cards: userCards, blockHash: currentBlockHash });

  } catch (error) {
    console.error('Error in /api/cards:', error);
    // Handle potential errors from BlockCypher API call itself (e.g., 404 Not Found for txId)
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Transaction ID not found.' });
    }
    if (error.response && error.response.status >= 400) {
       return res.status(error.response.status).json({ error: 'Error fetching transaction details.', details: error.response.data });
    }
    res.status(500).json({ error: 'Server error while generating cards.', details: error.message });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app; 
