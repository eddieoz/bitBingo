import React from 'react';
import { Card, ListGroup, Badge, Button, Spinner } from 'react-bootstrap';

// Helper to get BINGO letter
function getBingoLetter(num) {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  if (num >= 61 && num <= 75) return 'O';
  return '?';
}

function GameStateDisplay({ gameState, onRefresh }) {
  const { drawnNumbers, stats, drawIndex, loading, error } = gameState;

  return (
    <div className="game-state-display my-3">
      <h4 className="mb-3">
        Current Game State 
        <Button variant="outline-secondary" size="sm" onClick={onRefresh} disabled={loading} className="ms-2">
          {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Refresh'}
        </Button>
      </h4>
      
      {error && <p className="text-danger">Error loading game state: {error}</p>}

      <Card className="mb-3">
        <Card.Header>Drawn Numbers ({drawnNumbers?.length || 0} / 75)</Card.Header>
        <Card.Body style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {drawnNumbers && drawnNumbers.length > 0 ? (
            <div className="d-flex flex-wrap gap-2">
              {drawnNumbers.map((num, index) => (
                <Badge pill bg="info" key={`${num}-${index}`} className="fs-6">
                  {getBingoLetter(num)}{num}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted">No numbers drawn yet.</p>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Card Statistics</Card.Header>
        <ListGroup variant="flush">
          {stats && stats.length > 0 ? (
            stats.map(stat => (
              <ListGroup.Item key={`stat-${stat.needed}`}>
                {stat.needed === 0 ? (
                  <span className="fw-bold text-success">{stat.count} Winner(s)!</span>
                ) : (
                  <span>{stat.count} card(s) need {stat.needed} more number(s)</span>
                )}
              </ListGroup.Item>
            ))
          ) : (
             <ListGroup.Item className="text-muted">No statistics available yet.</ListGroup.Item>
          )}
           {/* Display specific error if stats calculation failed on backend */}
           {gameState.statsError && ( 
              <ListGroup.Item className="text-warning">Stats Error: {gameState.statsError}</ListGroup.Item>
           )}
        </ListGroup>
      </Card>
      
      <p className="text-muted mt-2"><small>Draw Index: {drawIndex}</small></p>
    </div>
  );
}

export default GameStateDisplay; 