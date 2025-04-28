const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const utils = require('./utils'); 
const axios = require('axios');
const FormData = require('form-data');
const csvtojson = require('csvtojson');
require('dotenv').config(); // Ensure env vars like PINATA_JWT are loaded

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// --- In-Memory Storage --- 
// TODO: Replace with a persistent database for production
const gameStates = new Map(); // txid -> gameState
const uploadedFiles = new Map(); // filename -> filePath

// --- Pinata Config (from bitRaffle) ---
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_UPLOAD_URL = process.env.PINATA_UPLOAD_URL || 'https://uploads.pinata.cloud/v3/files'; 
const PINATA_PUBLIC_GATEWAY_BASE = process.env.PINATA_PUBLIC_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/'; // Example Pinata gateway

// --- File Upload Setup ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Keep original filename but ensure uniqueness if needed (e.g., add timestamp)
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage: storage });

// --- Helper: Upload to Pinata (REVERTED to bitRaffle V3 structure) ---
async function uploadToPinata(filePath, fileName) {
  if (!PINATA_JWT) {
      console.error('Pinata JWT key is missing. Cannot upload to IPFS.');
      throw new Error('IPFS configuration error: Missing Pinata JWT.');
  }
  try {
    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    // Match bitRaffle payload
    formData.append('file', fileStream, { filename: fileName }); // Keep filename hint for stream
    formData.append('name', fileName); // Explicit name field
    formData.append('network', 'public'); // Network field used by bitRaffle

    console.log(`[Pinata V3] Uploading ${fileName} to ${PINATA_UPLOAD_URL}`);
    const response = await axios.post(PINATA_UPLOAD_URL, formData, {
      maxBodyLength: Infinity, // Ensure large files are allowed
      headers: {
        // Use the form-data library's generated headers
        ...formData.getHeaders(), 
        // Override Authorization header
        'Authorization': `Bearer ${PINATA_JWT}`
      }
    });
    console.log('[Pinata V3] Upload successful:', response.data);
    // Assuming V3 response structure provides CID directly
    if (!response.data || !response.data.data || !response.data.data.cid) { 
        // Log the actual response for debugging if CID is missing
        console.error('[Pinata V3] Unexpected response structure:', response.data);
        throw new Error('IPFS CID not found in Pinata V3 response data object.');
    }
    return response.data.data.cid; // Return the IPFS CID from V3 response data object
  } catch (error) {
    console.error('[Pinata V3] Error uploading:', error.response?.data || error.message);
    let errorMsg = 'Failed to upload file to IPFS via Pinata V3.';
    if (error.response?.status === 401) {
        errorMsg = 'IPFS upload failed: Invalid Pinata JWT or insufficient scopes for V3 endpoint.';
    } else if (error.response?.data?.error) {
        errorMsg = `IPFS upload failed: ${error.response.data.error}`;
    } else if (error.message.includes('IPFS CID not found')) {
        errorMsg = error.message; // Propagate specific CID error
    }
    throw new Error(errorMsg);
  }
}

// --- NEW: Reusable Statistics Calculation Function ---
function calculateStatistics(gameState) {
  let statistics = "Statistics not available yet.";
  if (!gameState || !gameState.cards || gameState.cards.length === 0 || !gameState.drawnNumbers || gameState.drawnNumbers.length === 0) {
    return statistics;
  }

  const drawnNumbersSet = new Set(gameState.drawnNumbers);
  let useFullCardStats = false;
  if (gameState.gameMode === 'fullCardOnly') {
      useFullCardStats = true;
  } else if (gameState.gameMode === 'partialAndFull' && (gameState.continueAfterPartialWin || gameState.isOver)) {
      useFullCardStats = true;
  }

  if (useFullCardStats) {
      const markedCounts = gameState.cards.map(card => utils.countMarkedDrawnNumbers(card.grid, drawnNumbersSet));
      const countsMap = markedCounts.reduce((acc, count) => {
          if (count > 0) { acc[count] = (acc[count] || 0) + 1; }
          return acc;
      }, {});
      const sortedCounts = Object.entries(countsMap)
          .map(([markedNum, playerCount]) => ({ markedNum: parseInt(markedNum, 10), playerCount }))
          .sort((a, b) => b.markedNum - a.markedNum);
      if (sortedCounts.length > 0) {
          statistics = sortedCounts.map(stat => 
            `${stat.playerCount} player${stat.playerCount > 1 ? 's' : ''} ${stat.playerCount > 1 ? 'have' : 'has'} ${stat.markedNum} number${stat.markedNum > 1 ? 's' : ''} marked`
          ).join('\n');
      } else {
          statistics = "No players have marked any numbers yet.";
      }
  } else {
      const maxInLineCounts = gameState.cards.map(card => utils.calculateMaxMarkedInLine(card.grid, drawnNumbersSet));
      const countsMap = maxInLineCounts.reduce((acc, count) => {
          if (count >= 2) { acc[count] = (acc[count] || 0) + 1; }
          return acc;
      }, {});
      const sortedCounts = Object.entries(countsMap)
          .map(([markedNum, playerCount]) => ({ markedNum: parseInt(markedNum, 10), playerCount }))
          .sort((a, b) => b.markedNum - a.markedNum);
      if (sortedCounts.length > 0) {
        statistics = sortedCounts.map(stat => 
          `${stat.playerCount} player${stat.playerCount > 1 ? 's' : ''} ${stat.playerCount > 1 ? 'have' : 'has'} a line with ${stat.markedNum} mark${stat.markedNum > 1 ? 's' : ''}`
        ).join('\n');
      } else {
        statistics = "No players have 2 or more marks in a line yet."; 
      }
  }
  return statistics;
}

// --- Exported Handler Function for Check Transaction ---
export async function handleCheckTransaction(req, res) {
  const { txid, participantFilename, gameMode } = req.body;
  console.log(`[Check TX] Received request for TXID: ${txid}, Filename: ${participantFilename}, Mode: ${gameMode}`);

  // Basic validation
  if (!txid || !participantFilename) {
    return res.status(400).json({ message: 'Missing txid or participantFilename in request body.' });
  }

  // --- ADD Game Mode Validation ---
  const validGameModes = ['partialAndFull', 'fullCardOnly'];
  if (!gameMode || !validGameModes.includes(gameMode)) {
    console.warn(`[Check TX] Invalid or missing gameMode provided: ${gameMode}. Defaulting to 'fullCardOnly'.`);
    // Allow default for now, or return error? Let's return error for clarity.
    return res.status(400).json({ message: `Invalid or missing gameMode. Must be one of: ${validGameModes.join(', ')}` });
  }
  // --- End Game Mode Validation ---

  // Revert to direct fs.existsSync check
  // IMPORTANT: Use path.basename to prevent path traversal vulnerabilities
  const safeFilename = path.basename(participantFilename); 
  const participantFilePath = path.join(UPLOADS_DIR, safeFilename); // Use consistent UPLOADS_DIR

  if (!fs.existsSync(participantFilePath)) {
    console.error(`[Check TX] Participant file path not found or invalid: ${participantFilePath}`);
    return res.status(404).json({ message: 'Participant file not found.' });
  }

  // Check if game already initialized for this txid
  if (gameStates.has(txid)) {
    console.log(`[Check TX] Game state for ${txid} already exists.`);
    const existingGameState = gameStates.get(txid); // Retrieve the existing state
    // Optionally update participants if re-checking? For now, assume immutable after init.
    // gameState.participants = participants; // If you want to allow updates
    // gameState.blockHash = blockHash; // Should be the same, but can update

    // --- If game already existed, don't send token ---
    res.status(200).json({
        message: 'Transaction confirmed and game state verified.', // Slightly different message
        txid: txid,
        blockHash: existingGameState.blockHash, // Use the blockHash fetched in this request context
        // Use the retrieved existingGameState here
        participantCount: existingGameState ? existingGameState.participants.length : 0 // Add a check in case it's somehow null/undefined
    });
    return; // Exit here after sending init response
  }

  try {
    // Fetch TX data to get block hash and OP_RETURN
    console.log(`[Check TX] Fetching TX data for ${txid}...`);
    const { blockHash, opReturnHex } = await utils.fetchTxDataAndBlockHash(txid);
    console.log(`[Check TX] TX ${txid} confirmed in block ${blockHash}. OP_RETURN hex: ${opReturnHex}`);

    // Fetch participants using the OP_RETURN data (as IPFS CID hex)
    console.log(`[Check TX] Fetching participants from OP_RETURN hex ${opReturnHex}...`);
    const participants = await utils.getParticipantsFromOpReturn(opReturnHex);
    console.log(`[Check TX] Successfully fetched ${participants.length} participants.`);

    // Validate participants against the uploaded file (Optional but recommended)
    // TODO: Implement a check if needed (e.g., compare first few names or count)
    console.log(`[Check TX] Participant validation against uploaded file ${participantFilename} - Skipping for now.`);

    // Initialize Game State if not exists
    console.log(`[Check TX] Initializing new game state for ${txid}`);
    const baseSeed = blockHash; // Use block hash as the base seed
    console.log(`[Check TX] Generating cards using base seed (blockhash): ${baseSeed}`);
    const allCards = utils.generateAllCards(participants, baseSeed);
    
    // Clean up uploaded file after use - MOVED TO END AFTER SUCCESSFUL INIT
    // const filePathToDelete = path.join(UPLOADS_DIR, path.basename(participantFilename)); 
    // try {
    //     await fs.promises.unlink(filePathToDelete);
    //     console.log(`[Check TX] Successfully deleted uploaded file: ${filePathToDelete}`);
    // } catch (unlinkError) {
    //     console.error(`[Check TX] Error deleting participant file ${filePathToDelete}:`, unlinkError);
    //     // Decide if this should be a fatal error for the request. 
    //     // For now, we'll log it but proceed as the game state is initialized.
    // }

    // --- Generate GM Token during initialization --- 
    const initialGmToken = crypto.randomBytes(16).toString('hex');
    console.log(`[Check TX] Generated initial GM Token for ${txid}`);

    gameStates.set(txid, {
        txid: txid,
        status: 'initialized',
        blockHash: blockHash, // Store the block hash
        participants: participants, // Store the fetched participants
        baseSeed: baseSeed,
        cards: allCards, 
        drawnNumbers: [],
        drawSequence: [], // Store the sequence of derived public keys
        nextDerivationIndex: 0, 
        gmToken: initialGmToken, // Store the generated GM token
        lastDrawTime: null,
        // --- NEW Game Mode Fields ---
        gameMode: gameMode, // <-- USE gameMode from request body
        partialWinOccurred: false,
        partialWinners: null,
        fullCardWinners: null,
        // --- End NEW Fields ---
        isOver: false,
        continueAfterPartialWin: false, // NEW: Track if GM continued after partial win
        winners: [] // Keep existing winners for now, might adjust later
    });
    console.log(`[Check TX] Game state for ${txid} successfully initialized with ${allCards.length} cards.`);
    
    // --- Return the newly generated token only on initialization --- 
    res.status(200).json({ 
        message: 'Transaction confirmed and game state initialized.',
        txid: txid,
        blockHash: blockHash,
        participantCount: participants.length,
        gmToken: initialGmToken // Include the new token
    });

    // Delete the uploaded file using the *validated* path AFTER successful response
    try {
        await fs.promises.unlink(participantFilePath); // Use the path checked by existsSync
        console.log(`[Check TX] Successfully deleted uploaded file: ${participantFilePath}`);
    } catch (unlinkError) {
        console.error(`[Check TX] Error deleting participant file ${participantFilePath}:`, unlinkError);
        // Log and proceed
    }

  } catch (error) {
    console.error(`[Check TX] Error processing transaction ${txid}:`, error.message);
    // Clean up file on error using the validated path
    if (participantFilePath && fs.existsSync(participantFilePath)) { 
        try {
            await fs.promises.unlink(participantFilePath);
            console.log(`[Check TX] Successfully deleted uploaded file after error: ${participantFilePath}`);
        } catch (unlinkError) {
            console.error(`[Check TX] Error deleting participant file ${participantFilePath} after error:`, unlinkError);
        }
    }
    
    let statusCode = 500;
    if (error.message.includes('Transaction ID not found')) statusCode = 404;
    if (error.message.includes('Transaction not yet confirmed')) statusCode = 409; // Conflict or Precondition Failed
    if (error.message.includes('No OP_RETURN data') || error.message.includes('IPFS CID')) statusCode = 400; // Bad Request - TX might be invalid
    if (error.message.includes('rate limit reached')) statusCode = 429; // Too Many Requests
    if (error.message.includes('Failed to retrieve or decode participant list')) statusCode = 502; // Bad Gateway (IPFS issue)

    res.status(statusCode).json({ 
        message: `Failed to process transaction: ${error.message}`
    });
  }
}

// --- 2. Check Transaction & Initialize Game --- 
app.post('/api/check-transaction', handleCheckTransaction); // Use the extracted handler

// --- 3. Draw Next Number (GM Only) --- 
function handleDraw(req, res, utilsOverride) {
  const utilsToUse = utilsOverride || utils;
  const { txid } = req.params;
  const gameState = gameStates.get(txid);

  console.log(`[Draw] Request received for game ${txid}`);

  if (!gameState) {
    console.warn(`[Draw] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found or not initialized.' });
  }

  // --- GM Token Verification --- 
  const authHeader = req.headers.authorization;
  const providedToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  
  // Token MUST always be provided and match the one generated at initialization
  if (!providedToken) {
      console.warn(`[Draw] Missing GM token for game ${txid}`);
      return res.status(401).json({ message: 'Authorization token required for drawing numbers.'});
  }
  if (providedToken !== gameState.gmToken) {
      console.warn(`[Draw] Invalid GM token provided for game ${txid}. Expected: ${gameState.gmToken ? gameState.gmToken.substring(0,4)+'...' : 'null'}, Got: ${providedToken ? providedToken.substring(0,4)+'...' : 'null'}`); // Added logging
      return res.status(403).json({ message: 'Invalid authorization token.' });
  }
  console.log(`[Draw] GM token verified for ${txid}`);
  
  // --- End GM Token Verification ---

  // --- Check if game already ended ---
  if (gameState.isOver) {
    console.log(`[Draw] Game ${txid} is already over. Winners: ${gameState.winners.join(', ')}`);
    return res.status(400).json({
        message: 'Game is already over.',
        winners: gameState.winners,
        drawnNumbers: gameState.drawnNumbers,
        totalDrawn: gameState.drawnNumbers.length
    });
  }

  if (gameState.drawnNumbers.length >= 75) {
    console.log(`[Draw] All 75 numbers already drawn for game ${txid}`);
    return res.status(400).json({ message: 'All 75 numbers have been drawn.' });
  }

  const index = gameState.nextDerivationIndex;
  const seed = gameState.baseSeed; // Use the stored base seed (block hash)
  let drawnNumber;
  let derivedPublicKey;
  let attempts = 0;
  const maxAttempts = 1000; // Avoid infinite loops

  console.log(`[Draw] Attempting to draw number using index ${index} and seed ${seed.substring(0,8)}...`);
  do {
      try {
          // Derive the public key using the NEXT index
          derivedPublicKey = utilsToUse.derivePublicKey(seed, index + attempts);
          // Hash the public key to get a number (1-75)
          drawnNumber = utilsToUse.hashPublicKeyToNumber(derivedPublicKey);

          if (gameState.drawnNumbers.includes(drawnNumber)) {
             console.log(`[Draw] Number ${drawnNumber} (from index ${index + attempts}) already drawn, retrying...`);
          }
      } catch (error) {
          console.error(`[Draw] Error during number derivation for game ${txid} at index ${index + attempts}:`, error);
          return res.status(500).json({ message: `Failed to derive number: ${error.message}`});
      }
      attempts++;
      if (attempts > maxAttempts) {
          console.error(`[Draw] Maximum derivation attempts (${maxAttempts}) reached for game ${txid}. Aborting draw.`);
          return res.status(500).json({ message: 'Failed to draw a unique number after many attempts.'});
      }
  } while (gameState.drawnNumbers.includes(drawnNumber));

  // Success! Store the number and update state
  gameState.drawnNumbers.push(drawnNumber);
  gameState.drawSequence.push({ index: index + attempts - 1, publicKey: derivedPublicKey, number: drawnNumber });
  gameState.nextDerivationIndex = index + attempts; // Set the *next* index to use
  gameState.lastDrawTime = Date.now();

  console.log(`[Draw] Successfully drawn number ${drawnNumber} for game ${txid} (using derivation index ${index + attempts - 1}). Next index: ${gameState.nextDerivationIndex}`);

  // --- NEW: Refactored Winner Check based on Game Mode ---
  let hasLineWin = false;
  let hasFullCardWin = false;
  let currentLineWinners = [];
  let currentFullCardWinners = [];

  // Only check for wins if enough numbers are drawn
  const drawnNumbersSet = new Set(gameState.drawnNumbers); // Use Set for efficient lookups

  if (gameState.gameMode === 'fullCardOnly') {
    currentFullCardWinners = []; // <-- Reset before checking
    if (drawnNumbersSet.size >= 24) { // Min numbers for full card win
      for (const card of gameState.cards) {
        if (utilsToUse.checkFullCardWin(card.grid, drawnNumbersSet)) {
          hasFullCardWin = true;
          currentFullCardWinners.push({ 
              username: card.username, 
              cardId: card.cardId, 
              // No specific sequence for full card win
              sequence: 'Full Card' 
          });
        }
      }
    }
    if (hasFullCardWin) {
      gameState.isOver = true;
      gameState.fullCardWinners = currentFullCardWinners; 
      console.log(`[Draw][FullCardOnly] Game ${txid} finished! Winners: ${currentFullCardWinners.map(w => w.username).join(', ')}`);
    }
  } else { // gameMode === 'partialAndFull'
    // --- Phase 1: Check for Line Win (if partial win hasn't happened yet) --- 
    if (!gameState.partialWinOccurred && drawnNumbersSet.size >= 5) {
      currentLineWinners = []; // <-- Reset before checking
      for (const card of gameState.cards) {
        const winningSequence = utilsToUse.checkLineWin(card.grid, drawnNumbersSet);
        if (winningSequence) {
          hasLineWin = true;
          currentLineWinners.push({ 
              username: card.username, 
              cardId: card.cardId, 
              sequence: winningSequence
          });
        }
      }
      // Check if the loop actually found any winners
      if (currentLineWinners.length > 0) {
        gameState.partialWinOccurred = true;
        gameState.partialWinners = currentLineWinners;
        console.log(`[Draw][PartialAndFull] Partial Win Detected! Winners: ${currentLineWinners.map(w => w.username).join(', ')}. Game continues.`);
      }
    }

    // --- Phase 2: Check for Full Card Win (only if partial win has occurred) --- 
    if (gameState.partialWinOccurred && drawnNumbersSet.size >= 24) {
      currentFullCardWinners = []; // <-- Reset before checking
      for (const card of gameState.cards) {
        if (utilsToUse.checkFullCardWin(card.grid, drawnNumbersSet)) {
          hasFullCardWin = true;
          currentFullCardWinners.push({ 
              username: card.username, 
              cardId: card.cardId, 
              sequence: 'Full Card' 
          });
        }
      }
      if (hasFullCardWin) {
        gameState.isOver = true;
        gameState.fullCardWinners = currentFullCardWinners;
        console.log(`[Draw][PartialAndFull] Full Card Win Detected! Game ${txid} finished! Winners: ${currentFullCardWinners.map(w => w.username).join(', ')}`);
      }
    }
  }
  // --- End NEW Winner Check ---

  // --- Calculate statistics based on the final state for this draw --- 
  const finalStats = calculateStatistics(gameState);

  // --- Update Response Payload --- 
  const responsePayload = {
    message: 'Number drawn successfully!',
    drawnNumber: drawnNumber,
    totalDrawn: gameState.drawnNumbers.length,
    nextDerivationIndex: gameState.nextDerivationIndex,
    isOver: gameState.isOver,
    // Include new state fields
    gameMode: gameState.gameMode,
    partialWinOccurred: gameState.partialWinOccurred,
    partialWinners: gameState.partialWinners,
    fullCardWinners: gameState.fullCardWinners,
    statistics: finalStats // Include final stats 
    // Keep the old winners field for backward compatibility? Decide later. 
    // For now, removing it to avoid confusion.
    // winners: gameState.winners // REMOVED - Use specific winner fields
  };

  res.status(200).json(responsePayload);
}

app.post('/api/draw/:txid', (req, res) => handleDraw(req, res));

// --- NEW: End Game Manually (GM Only, for Partial Win Scenario) ---
app.post('/api/end-game/:txid', (req, res) => {
  const { txid } = req.params;
  const gameState = gameStates.get(txid);

  console.log(`[End Game] Request received for game ${txid}`);

  if (!gameState) {
    console.warn(`[End Game] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found.' });
  }

  // GM Token Verification (Same as /api/draw)
  const authHeader = req.headers.authorization;
  const providedToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!providedToken) {
      console.warn(`[End Game] Missing GM token for game ${txid}`);
      return res.status(401).json({ message: 'Authorization token required.'});
  }
  if (providedToken !== gameState.gmToken) {
      console.warn(`[End Game] Invalid GM token provided for game ${txid}.`);
      return res.status(403).json({ message: 'Invalid authorization token.' });
  }
  console.log(`[End Game] GM token verified for ${txid}`);

  // Check if game is already over
  if (gameState.isOver) {
    console.log(`[End Game] Game ${txid} is already over.`);
    return res.status(400).json({ message: 'Game is already over.' });
  }

  // Check if it's in the correct mode and state for ending
  if (gameState.gameMode !== 'partialAndFull' || !gameState.partialWinOccurred) {
     console.log(`[End Game] Game ${txid} is not in a state that can be ended manually (Mode: ${gameState.gameMode}, Partial Win: ${gameState.partialWinOccurred}).`);
     return res.status(400).json({ message: 'Game can only be ended manually after a partial win in PartialAndFull mode.' });
  }

  // Set the game as over
  gameState.isOver = true;
  console.log(`[End Game] Game ${txid} has been manually set to ended by GM.`);

  res.status(200).json({
    message: 'Game successfully ended by Game Master.',
    isOver: true,
    partialWinners: gameState.partialWinners // Return the winners determined so far
  });
});

// --- NEW: Continue Game After Partial Win (GM Only) ---
app.post('/api/continue-game/:txid', (req, res) => {
  const { txid } = req.params;
  const gameState = gameStates.get(txid);

  console.log(`[Continue Game] Request received for game ${txid}`);

  if (!gameState) {
    return res.status(404).json({ message: 'Game not found.' });
  }

  // GM Token Verification
  const authHeader = req.headers.authorization;
  const providedToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!providedToken || providedToken !== gameState.gmToken) {
    return res.status(403).json({ message: 'Invalid or missing authorization token.' });
  }

  // Check game state conditions
  if (gameState.isOver) {
    return res.status(400).json({ message: 'Game is already over.' });
  }
  if (gameState.gameMode !== 'partialAndFull') {
    return res.status(400).json({ message: 'Game is not in partialAndFull mode.' });
  }
  if (!gameState.partialWinOccurred) {
    return res.status(400).json({ message: 'Partial win has not occurred yet.' });
  }
  if (gameState.continueAfterPartialWin) {
    return res.status(400).json({ message: 'Game continuation already confirmed.' });
  }

  // Set the continuation flag
  gameState.continueAfterPartialWin = true;
  console.log(`[Continue Game] GM confirmed continuation for game ${txid}. Statistics will now track full card progress.`);

  // Return updated state? Just success is probably fine, frontend polling will get state.
  res.status(200).json({
    message: 'Game continuation confirmed. Full card statistics will now be shown.',
    continueAfterPartialWin: true
  });
});

// --- 4. Get Game State (Player & GM) ---
app.get('/api/game-state/:txid', (req, res) => {
  const { txid } = req.params;
  const isGmRequest = req.query.gm === 'true'; // Simpler GM check via query param for polling
  console.log(`[State] Request for game state: ${txid}, Is GM Request: ${isGmRequest}`);

  const gameState = gameStates.get(txid);

  if (!gameState) {
    console.error(`[State] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found.' });
  }

  // Calculate statistics 
  const statistics = calculateStatistics(gameState);

  // Base response object (player view)
  const responseBody = {
    drawnNumbers: gameState.drawnNumbers,
    isOver: gameState.isOver,
    gameMode: gameState.gameMode,
    partialWinOccurred: gameState.partialWinOccurred,
    partialWinners: gameState.partialWinners,
    fullCardWinners: gameState.fullCardWinners,
    statistics: statistics
  };

  // Add GM-specific fields if requested
  if (isGmRequest) {
    // Simple check: Could verify token here if needed
    responseBody.continueAfterPartialWin = gameState.continueAfterPartialWin;
    console.log(`[State] GM requested state for ${txid}, adding extra fields.`);
  } else {
    console.log(`[State] Player requested state for ${txid}.`);
  }

  return res.status(200).json(responseBody);
});


// --- 5. Get Player Cards --- 
app.get('/api/cards/:txid/:nickname', (req, res) => {
  const { txid, nickname } = req.params;
  console.log(`[Cards] Request for player '${nickname}' in game ${txid}`);

  // Validate input
  if (!txid || !nickname) {
      // This case is less likely with path params but good practice
      return res.status(400).json({ error: 'Missing txid or nickname in path.'});
  }

  const gameState = gameStates.get(txid);

  if (!gameState) {
    console.error(`[Cards] Game state not found for ${txid}`);
    // Return consistent error format
    return res.status(404).json({ error: 'Game state not found.' });
  }

  // Filter cards for the specific nickname (case-insensitive)
  const userCards = gameState.cards.filter(
    card => card.username.toLowerCase() === nickname.toLowerCase()
  );

  if (userCards.length === 0) {
    console.error(`[Cards] No cards found for nickname '${nickname}' in game ${txid}`);
    // Return consistent error format
    return res.status(404).json({ error: `Nickname '${nickname}' not found in participant list for this game.` });
  }

  console.log(`[Cards] Found ${userCards.length} card(s) for '${nickname}' in game ${txid}`);
  // Return the success format expected by tests
  res.status(200).json({
    status: 'success',
    cards: userCards,
    blockHash: gameState.blockHash // Include blockHash
  });
});

// ======================================================
// ==                Server Start                      ==
// ======================================================

// Only start listening if the script is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`BitBingo Server listening on port ${PORT}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);
    // Log environment variables being used (optional, for debugging)
    console.log(`BLOCKCYPHER_API_BASE_URL: ${process.env.BLOCKCYPHER_API_BASE_URL || 'Default (Blockcypher v1)'}`);
    console.log(`PINATA_PUBLIC_GATEWAY_BASE: ${process.env.PINATA_PUBLIC_GATEWAY_BASE || 'Default (ipfs.io)'}`);
    console.log(`BLOCKCYPHER_NETWORK: ${process.env.BLOCKCYPHER_NETWORK || 'Default (main)'}`);
  });
}

// Export the app and gameStates for testing or direct use
module.exports = { app, gameStates, uploadDir: UPLOADS_DIR, handleDraw }; // Also export uploadDir if needed by tests