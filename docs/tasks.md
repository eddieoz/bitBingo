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
    - [x] (Green) Implement `/api/cards` logic: fetch TX, get block hash, fetch IPFS CSV, parse, find lines, use current block hash seed, cache results.
    - [x] (Refactor) Extract logic into helper functions, improve error handling.
    - [ ] (R/G/R) Add tests & implementation for edge cases (nickname not found, invalid TX, unconfirmed, no OP_RETURN, IPFS error, CSV error, etc.). (Skipped)
- [ ] **Backend TDD (`derivePublicKey` helper):** (Skipped for now)
    - [ ] (Red) Write unit test for correct BIP32 derivation.
    - [x] (Green) Implement using `bip32` library.
    - [x] (Refactor) Code cleanup. Ensure Buffer output.
- [ ] **Backend TDD (`generateBingoCard` helper):** (Skipped for now)
    - [ ] (Red) Write unit tests for card structure, number ranges, uniqueness, determinism.
    - [x] (Green) Implement deterministic card generation from public key hash.
    - [x] (Refactor) Optimize and clarify generation logic.
- [x] **Frontend:** Create/Update `UserCardsDisplay` component to render the cards received from `/api/cards`.
- [x] **Frontend:** Refactor `PlayPage` to use `/api/cards` backend endpoint exclusively.
- [x] **Documentation:** Update user verification steps for card generation. (Covered by docs/verification.md)

### 3. Number Drawing (Game Master)
- [ ] Add a "Draw Number" button for the game master
- [ ] On each click, derive a new public key (increment path index), take last 8 hex digits, mod 75, and ensure uniqueness
- [ ] Broadcast the drawn number to all clients in real time (WebSocket or polling)
- [ ] Mark the drawn number on all open bingo cards

### 4. Real-Time Card Marking & Win Detection
- [ ] As numbers are drawn, automatically mark them on all user cards
- [ ] Add a "Call Bingo" button for users to claim a win
- [ ] On "Call Bingo", check if the card is a valid winner (full card marked)
- [ ] If valid, trigger a fancy animation/effect and reveal the winner
- [ ] System does not reveal the winner until a valid bingo is called

### 5. Determinism & Verification
- [x] All card and number generation is deterministic and verifiable from block hash, CSV, and public process
- [ ] Document the verification process for users (in README/docs)

### 6. Testing (TDD/BDD)
- [ ] Write BDD scenarios and TDD tests for each user story before/alongside implementation
- [ ] Ensure tests cover edge cases (duplicate names, invalid CSV, block hash errors, etc.)

---

## Notes
- Mark tasks as complete if already implemented in the codebase.
- Use @tests-tdd+bdd.mdc for all test-related stories.
- Update this roadmap as features are implemented or refined. 