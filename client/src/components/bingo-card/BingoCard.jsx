import React from 'react';
import {
  Table,
  // Container, 
  // Row, 
  // Col,
  Card // Added Card for better visual separation
} from 'react-bootstrap';
import './BingoCard.css'; // We'll create this CSS file

/**
 * Renders a single 5x5 Bingo card grid.
 * Expects a card prop, an optional drawnNumbers array, and an optional winningSequence array.
 * { 
 *   card: { cardId, lineIndex, grid: { B, I, N, G, O } },
 *   drawnNumbers?: number[],
 *   winningSequence?: (number | string)[] | null
 * }
 */
function BingoCard({ card, drawnNumbers = [], winningSequence = null }) {
  if (!card || !card.grid) {
    return <p>Invalid card data</p>;
  }

  const columns = ['B', 'I', 'N', 'G', 'O'];
  const drawnSet = new Set(drawnNumbers);
  const winningSet = winningSequence 
    ? new Set(winningSequence.filter(item => typeof item === 'number')) 
    : null;
  const winningSequenceIncludesFree = winningSequence ? winningSequence.includes('FREE') : false;

  return (
    <Card className="mb-3 bingo-card-wrapper">
      <Card.Header>Card #{card.lineIndex} (ID: ...{card.cardId.slice(-6)})</Card.Header>
      <Card.Body className="p-2"> 
        <Table bordered className="bingo-card-table mb-0">
          <thead>
            <tr>
              {columns.map(col => <th key={col}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map(rowIndex => (
              <tr key={rowIndex}>
                {columns.map(col => {
                  const number = card.grid[col][rowIndex];
                  const isFreeSpace = col === 'N' && rowIndex === 2;
                  const isMarked = isFreeSpace || drawnSet.has(number);
                  
                  // Determine if this specific cell is part of the win
                  const isWinningCell = 
                    (isFreeSpace && winningSequenceIncludesFree) || 
                    (!isFreeSpace && winningSet && winningSet.has(number));
                  
                  // Build classes
                  let cellClasses = [];
                  if (isFreeSpace) cellClasses.push('free-space');
                  if (isMarked) cellClasses.push('marked');
                  if (isWinningCell) cellClasses.push('winning-number');

                  return (
                    <td 
                      key={`${col}-${rowIndex}`} 
                      className={cellClasses.join(' ')}
                    >
                      {isFreeSpace ? 'FREE' : number}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

export default BingoCard; 