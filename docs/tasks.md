# EPIC: Transform bitRaffle into bitBingo (@tests-tdd+bdd.mdc)

## Description
Implement a provably-fair, trustless, and verifiable bingo game using Bitcoin and IPFS, adapting the existing bitRaffle codebase. The system must allow users to upload a CSV of usernames, anchor the file in a Bitcoin transaction, generate deterministic bingo cards, and play a real-time bingo game with verifiable draws and winner detection.

---

## Roadmap & Stories

### 1. CSV Upload & Anchoring
- [x] User uploads a CSV file with one username per line (each line = one bingo card)
- [x] CSV is uploaded to IPFS, CID is returned
- [x] CID is anchored in a Bitcoin transaction via OP_RETURN
- [x] System monitors transaction and retrieves block hash

### 2. Card Generation & User Login (@tests-tdd+bdd.mdc)
- [x] **Define BDD Scenarios:** Detail expected behavior for card retrieval, nickname not found, invalid TXID, unconfirmed TX, missing OP_RETURN.
- [x] **Frontend:** Modify PlayPage input from Block Number to Transaction ID.
- [ ] **Backend TDD (`/api/cards`):** (Skipped for now due to test environment issues)
    - [ ] (Red) Write failing integration test for happy path (mocks: BlockCypher, IPFS).
    - [~] (Green) Implement `/api/cards` logic: fetch TX, get block hash, fetch IPFS CSV, parse, find lines, use current block hash seed, cache results. (Implemented via `/api/check-transaction` init and `/api/game-state/:txid/cards` retrieval, not a dedicated `/api/cards` for initial fetch)
    - [x] (Refactor) Extract logic into helper functions, improve error handling. (Logic is in `server/utils.js`)
    - [ ] (R/G/R) Add tests & implementation for edge cases (nickname not found, invalid TX, unconfirmed, no OP_RETURN, IPFS error, CSV error, etc.). (Skipped)
- [ ] **Backend TDD (`derivePublicKey` helper):** (Skipped for now)
    - [ ] (Red) Write unit test for correct BIP32 derivation.
    - [x] (Green) Implement using `bip32` library. (Exists in `server/utils.js`)
    - [x] (Refactor) Code cleanup. Ensure Buffer output.
- [ ] **Backend TDD (`generateBingoCard` helper):** (Skipped for now)
    - [ ] (Red) Write unit tests for card structure, number ranges, uniqueness, determinism.
    - [x] (Green) Implement deterministic card generation from public key hash. (Logic exists in `server/utils.js`)
    - [x] (Refactor) Optimize and clarify generation logic.
- [x] **Frontend:** Create/Update `UserCardsDisplay` component to render the cards received from `/api/cards`. (Exists and used in `PlayPage.jsx`)
- [x] **Frontend:** Refactor `PlayPage` to use `/api/cards` backend endpoint exclusively. (Uses `/api/check-transaction` and `/api/game-state/:txid/cards`)
- [x] **Documentation:** Update user verification steps for card generation. (Covered by docs/verification.md)

### 3. Number Drawing (Game Master)
- [x] **Backend:** Create `/api/draw/{txid}` endpoint. (Exists in `server/index.js`)
    - [x] Verify request comes from the Game Master (user who initiated the game associated with `{txid}`, potentially checked via a client-side token/cookie set during initiation). (Implemented via simple bearer token check in `/api/draw/:txid`)
- [~] **Backend:** Implement logic within `/api/draw/{txid}`: (Base logic done, uniqueness TODO) -> (Base logic and uniqueness implemented)
    - [x] Maintain game state **in memory**, keyed by `{txid}` (incl. base derivation seed from block hash, list of drawn numbers, draw index). Retrieve block hash associated with `{txid}` if needed. (Uses `gameStates` Map in `server/index.js`)
    - [x] On draw request:
        - [x] Increment draw index (persistent for the specific `{txid}` game instance in memory). (Uses `nextDerivationIndex`)
        - [x] Derive public key using base seed + draw index (use `server/utils.js` logic). (Implemented)
        - [x] Hash public key, take last 8 hex digits, convert to decimal `(decimal % 75) + 1`. (Implemented in `utils.hashPublicKeyToNumber`)
        - [x] Ensure uniqueness against numbers already drawn for this `{txid}` game. If not unique, increment index and repeat derivation until a unique number is found. (Implemented with retry loop in `/api/draw/:txid`)
        - [x] Store the newly drawn unique number in the game state for `{txid}`. (Stored in `gameState.drawnNumbers`)
        - [ ] **(Optional Optimization):** Pre-calculate the full sequence of 75 numbers on game initialization to avoid repeated derivation checks during draw.
- [x] **Backend:** Create `/api/game-state/{txid}` endpoint. (Exists in `server/index.js`)
    - [x] Returns the current list/sequence of drawn numbers for the given `{txid}` game. (Implemented)
    - [ ] **(For GM Stats):** If requested by GM, also calculate and return statistics: (Logic not implemented in GET endpoint)
        - [ ] Retrieve all generated bingo cards for `{txid}` (using logic similar to `/api/cards`).
        - [ ] Compare drawn numbers against each card to find win progress.
        - [ ] Determine the top 3 closest-to-win states (e.g., 1 away, 2 away, 3 away) and the count of players in each state. Return this data.
- [ ] **Real-time (Polling):**
    - [ ] **Client (Player & GM):** Periodically poll the `/api/game-state/{txid}` endpoint (e.g., every 1-2 seconds) to get the latest drawn numbers (and stats for GM). (Not implemented in `PlayPage.jsx`)
- [ ] **Frontend (Game Master UI):**
    - [ ] Identify the GM client-side (e.g., set a flag/token in local storage when they submit the TXID on the PlayPage). (Not implemented in `PlayPage.jsx`)
    - [ ] Display a "Draw Number" button only if identified as GM for the current `{txid}`. (`DrawNumberButton.jsx` exists, but conditional rendering not implemented in `PlayPage.jsx`)
    - [ ] Button click handler calls `/api/draw/{txid}`. (Assumed for button component, not verified in page)
    - [ ] Display a statistics box showing the top 3 closest-to-win states and player counts, updated via polling `/api/game-state/{txid}`. (`GameStateDisplay.jsx` exists, but polling and stats display not implemented in `PlayPage.jsx`)
- [ ] **Frontend (Player UI):**
    - [ ] Receive updated drawn number list via polling `/api/game-state/{txid}`. (Not implemented in `PlayPage.jsx`)
    - [ ] Update React state with the list/sequence of drawn numbers. (Not implemented in `PlayPage.jsx`)
    - [ ] **Display Sequence:** Show the drawn numbers in order (e.g., "B:12, I:25, N:40, ...") at the top of the page. (Not implemented in `PlayPage.jsx`)
    - [ ] Pass the list of drawn numbers down to `BingoCard` component(s). (Not implemented in `PlayPage.jsx`)
    - [ ] Modify `BingoCard` to visually mark numbers present in the drawn numbers list. (Component needs modification and props)

### 4. Real-Time Card Marking & Win Detection
- [ ] As numbers are drawn, automatically mark them on all user cards (Requires polling/WebSocket and `BingoCard` update)

### 5. Determinism & Verification
- [x] All card and number generation is deterministic and verifiable from block hash, CSV, and public process (Based on server logic)
- [ ] Document the verification process for users (in README/docs) (Requires manual verification of docs)

### 6. Testing (TDD/BDD)
- [ ] Write BDD scenarios and TDD tests for each user story before/alongside implementation
- [ ] Ensure tests cover edge cases (duplicate names, invalid CSV, block hash errors, etc.)

---

## Notes
- Mark tasks as complete if already implemented in the codebase.
- Use @tests-tdd+bdd.mdc for all test-related stories.
- Update this roadmap as features are implemented or refined. 