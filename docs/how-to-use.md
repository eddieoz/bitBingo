# How to Use bitRaffle

Welcome to [bitRaffle](https://bitraffle.sats4.life), a trustless and transparent raffle system powered by Bitcoin's blockchain. This guide will walk you through each step of running a raffle and verifying its results.

## Quick Start Guide

1. **Prepare your participant list** in CSV format
2. **Upload your CSV** to the bitRaffle platform
3. **Create a Bitcoin transaction** with the IPFS data
4. **Submit the transaction ID** to bitRaffle
5. **Wait for confirmation** on the Bitcoin blockchain
6. **Get your winners** automatically selected by the system
7. **Verify the results** yourself (optional but encouraged)

## Detailed Instructions

### Step 1: Prepare Your Participant List

Create a CSV file with your participants. The file should:
- Have a header row with "name" (recommended)
- List each participant on a separate line
- Include only one entry per line

Example CSV:
```
name
John Doe
Jane Smith
Bob Johnson
Alice Williams
```

You can use any spreadsheet software like Excel or Google Sheets to create this file, then export/save as CSV.

### Step 2: Upload Your CSV to bitRaffle

1. Visit [https://bitraffle.sats4.life](https://bitraffle.sats4.life)
2. Click on the "Upload Participants" button
3. Select your CSV file from your device
4. The system will process your file and upload it to IPFS (a decentralized storage network)
5. Once uploaded, you'll receive a **CID (Content Identifier) in hex format**
6. Copy this hex value - you'll need it for the next step

### Step 3: Create a Bitcoin Transaction

You need to create a special Bitcoin transaction that includes your raffle data. This requires a Bitcoin wallet that supports custom scripts.

#### Using Electrum Wallet (recommended):

1. Download and install [Electrum](https://electrum.org/) if you don't have it
2. Open Electrum and go to the **Send** tab
3. In the **Pay to** field, enter exactly:
   ```
   script(OP_RETURN YOUR_CID_HEX_VALUE)
   ```
   For example:
   ```
   script(OP_RETURN 6261666b72656966753377663376717a347537756b747a65367465326c78623537656b777267336e67646a6c346b74676f6167356a667775646769)
   ```
4. Set **zero** for amount (the transaction is just for data storage, not value transfer)
5. Choose an appropriate fee (higher for faster confirmation)
6. Click **Pay...**, then **Sign** and **Broadcast**
7. Copy the **Transaction ID** (txid) that appears

### Step 4: Submit the Transaction ID to bitRaffle

1. Return to [https://bitraffle.sats4.life](https://bitraffle.sats4.life)
2. Enter the Transaction ID in the designated field
3. Click "Start Monitoring"

### Step 5: Wait for Blockchain Confirmation

The system will now monitor the Bitcoin blockchain until your transaction is confirmed in a block. This typically takes:
- 10 minutes on average
- Could be faster or slower depending on network congestion and the fee you paid

You can check the status on the bitRaffle page or through a block explorer like [Blockstream Explorer](https://blockstream.info/) by searching for your transaction ID.

### Step 6: View Your Winners

Once your transaction is confirmed:
1. Set the number of winners you wish to withdraw
2. The winners are determined using the block hash as a source of randomness, then derived bip32 wallets
3. You'll see the list of winners on screen
4. The process is deterministic, you can restart the process and will have always the same results.

### Step 7: Verify the Results (Optional)

One of the key benefits of bitRaffle is that anyone can independently verify the results. Here's how:

1. **Gather the necessary information:**
   - The block hash of the Bitcoin block containing your transaction
   - Your original CSV file with participants
   - The number of winners drawn

2. **Use the Ian Coleman BIP39 Tool:**
   - Go to [Ian Coleman's BIP39 Tool](https://iancoleman.io/bip39/)
   - Scroll down to the "BIP39 Seed" field and enter the block hash
   - Select the "BIP44" tab
   - Look at the derived public keys for paths starting with m/44'/0'/0'/0/0, m/44'/0'/0'/0/1, etc.

3. **Calculate Each Winner:**
   - For each winner, take the public key corresponding to the derivation path
   - Use the last 8 characters of the hex representation
   - Convert this to a decimal number
   - Calculate: winner_index = (decimal_number) modulo (total_participants)
   - The participant at position winner_index in your CSV is the winner (starting from zero)

Example calculation:
```
Public key for m/44'/0'/0'/0/0 ends with: 8fe9b231
Hex to decimal: 8fe9b231 = 2414255665
If you have 100 participants: 2414255665 % 100 = 65
The participant at position 65 is the winner (you count zero for the first participant)
```

## Troubleshooting

- **Transaction not confirming?** Check if you paid enough fee. You can try to "bump" the fee in Electrum.
- **CSV upload failing?** Ensure your CSV is properly formatted with a header row.
- **Winners not displaying?** Make sure your transaction has at least 1 confirmation on the blockchain.
- **Verification not matching?** Double-check that you're using the exact block hash and the same original participant list.

## Remember

- The entire process is trustless and transparent
- Winners are determined solely by Bitcoin's blockchain data
- No one (not even the raffle organizer) can manipulate the results
- All data is publicly verifiable

For questions or support, please refer to the project's GitHub repository or contact information provided on the website. 