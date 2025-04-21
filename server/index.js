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
const app = express();
const port = process.env.PORT || 5000;
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
      const publicUrl = `pink-manual-barnacle-530.mypinata.cloud/ipfs/${cid}`;

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
      const txApiUrl = `https://api.blockcypher.com/v1/btc/${network}/txs/${txId}`;

      console.log(`Checking transaction status from: ${txApiUrl}`);
      const response = await axios.get(txApiUrl);

      // Verify OP_RETURN data matches our IPFS hash
      const scripts = response.data.outputs.map(output => output.script_type === 'null-data' ? output.data_hex : null).filter(Boolean);

      if (!scripts.includes(currentRaffle.fileHash)) {
        return res.status(400).json({
          error: 'Transaction does not contain the correct IPFS hash in OP_RETURN',
          status: 'invalid'
        });
      }

      const isConfirmed = response.data.confirmed && response.data.block_hash;

      if (isConfirmed) {
        const blockHash = response.data.block_hash;
        currentRaffle.blockHash = blockHash;

        res.json({
          status: 'success',
          txId: currentRaffle.txId,
          blockHash,
          confirmed: true,
          confirmations: response.data.confirmations || 1,
          blockHeight: response.data.block_height
        });
      } else {
        res.json({
          status: 'pending',
          txId: currentRaffle.txId,
          confirmed: false,
          message: 'Transaction found but not yet confirmed in a block'
        });
      }
    } catch (apiError) {
      console.error('Error checking transaction via API:', apiError.response?.data || apiError.message);

      // If we get a 404, the transaction doesn't exist (yet)
      if (apiError.response && apiError.response.status === 404) {
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
          details: apiError.response?.data || apiError.message
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
    console.log(currentRaffle.blockHash)
    const mnemonic = bip39.entropyToMnemonic(currentRaffle.blockHash);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const bip32 = BIP32Factory(ecc)
    const root = bip32.fromSeed(seed);
    console.log("str",)
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
      let numericValue = uint8ArrayToBigInt(child.privateKey)
      pathIndex++
      let winnerIndex = numericValue % BigInt(participantCount);
      let winner = currentRaffle.participants[winnerIndex];
      if (winner && typeof winner === 'object') {
        if (!winner.name) {
          winner.name = `Participant ${winnerIndex + 1}`;
        }
        if (!winner.ticket) {
          winner.ticket = (winnerIndex + 1).toString();
        }
      }
      while (winnersArr.indexOf(winner.name) > -1) {
        pathIndex++
        derivationPath = `m/44'/0'/0'/0/${pathIndex}`
        child = root.derivePath(derivationPath)
        numericValue = uint8ArrayToBigInt(child.privateKey)
        winnerIndex = numericValue % BigInt(participantCount);
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

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 
