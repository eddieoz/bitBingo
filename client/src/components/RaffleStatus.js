import React from 'react';
import { Card, Button, Badge, Row, Col } from 'react-bootstrap';

const RaffleStatus = ({ raffleState, onRefresh }) => {
  const {
    fileUploaded,
    fileHash,
    participantCount,
    txId,
    txConfirmed,
    blockHash,
    winner,
    ipfsHash,
    loading
  } = raffleState;

  const getStatusBadge = (completed, text) => {
    return (
      <Badge bg={completed ? 'success' : 'secondary'}>
        {completed ? '✓ ' + text : 'Pending'}
      </Badge>
    );
  };

  const truncateHash = (hash) => {
    if (!hash) return '';
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 8);
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Raffle Status</span>
        <Button 
          variant="outline-primary" 
          size="sm" 
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={4} className="mb-3">
            <h6>File Upload {getStatusBadge(fileUploaded, 'Uploaded')}</h6>
            {fileUploaded && (
              <div className="small">
                <div>Participants: {participantCount}</div>
                <div>Hex CID: {truncateHash(fileHash)}</div>
                {ipfsHash && (
                  <div>
                    IPFS: <a href={`https://ipfs.io/ipfs/${ipfsHash}`} target="_blank" rel="noopener noreferrer">{truncateHash(ipfsHash)}</a>
                  </div>
                )}
              </div>
            )}
          </Col>
          <Col md={4} className="mb-3">
            <h6>Transaction {getStatusBadge(txId !== null, 'Submitted')}</h6>
            {txId && (
              <div className="small">
                <div>TX ID: {truncateHash(txId)}</div>
                <div>Status: {txConfirmed ? 'Confirmed' : 'Monitoring...'}</div>
                {blockHash && <div>Block Hash: {truncateHash(blockHash)}</div>}
              </div>
            )}
          </Col>
          <Col md={4} className="mb-3">
            <h6>Winner {getStatusBadge(winner !== null, 'Drawn')}</h6>
            {winner && (
              <div className="small">
                <div>Name: {winner.name || 'Unknown'}</div>
                <div>Ticket #: {winner.ticket || 'N/A'}</div>
              </div>
            )}
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default RaffleStatus; 