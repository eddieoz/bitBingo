import React, { useState } from 'react';

export function UserLogin({ csvData = [], onCardsReady }) {
  const [nickname, setNickname] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const [error, setError] = useState(null);
  const [noCards, setNoCards] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNoCards(false);
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    if (!blockNumber || isNaN(Number(blockNumber))) {
      setError('Invalid block number');
      return;
    }
    // Find all indices for this nickname
    const indices = csvData
      .map((row, idx) => row.name === nickname ? idx : -1)
      .filter(idx => idx !== -1);
    if (indices.length === 0) {
      setNoCards(true);
      return;
    }
    try {
      const res = await fetch(`/api/block-hash/${blockNumber}`);
      if (!res.ok) throw new Error('Block hash fetch failed');
      const { blockHash } = await res.json();
      if (onCardsReady) onCardsReady({ nickname, blockHash, indices });
    } catch (err) {
      setError('Invalid block number or block not found');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="nickname">Nickname</label>
      <input
        id="nickname"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        aria-label="nickname"
      />
      <label htmlFor="block-number">Block Number</label>
      <input
        id="block-number"
        value={blockNumber}
        onChange={e => setBlockNumber(e.target.value)}
        aria-label="block number"
      />
      <button type="submit">View My Cards</button>
      {error && <div>{error}</div>}
      {noCards && <div>No cards found</div>}
    </form>
  );
} 