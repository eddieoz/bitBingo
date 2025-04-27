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
 * Expects a card prop and an optional drawnNumbers array.
 * { 
 *   card: { cardId, lineIndex, grid: { B, I, N, G, O } },
 *   drawnNumbers: number[]
 * }
 */
function BingoCard({ card, drawnNumbers = [] }) {
  if (!card || !card.grid) {
    return <p>Invalid card data</p>;
  }

  const columns = ['B', 'I', 'N', 'G', 'O'];
  // Create a Set for efficient lookup of drawn numbers
  const drawnSet = new Set(drawnNumbers);

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
                  // Check if the number is drawn
                  const isMarked = !isFreeSpace && drawnSet.has(number);
                  
                  // Combine CSS classes
                  let cellClass = '';
                  if (isFreeSpace) cellClass = 'free-space';
                  if (isMarked) cellClass += ' marked'; // Add marked class

                  return (
                    <td 
                      key={`${col}-${rowIndex}`} 
                      className={cellClass.trim()} // Apply combined classes
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