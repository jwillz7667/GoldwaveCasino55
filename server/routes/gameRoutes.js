const express = require('express');
const router = express.Router();
const GameController = require('../controllers/GameController');
const { authenticateUser } = require('../middleware/auth');

// Game listing routes
router.get('/', GameController.getGames);
router.get('/active', GameController.getActiveGames);
router.get('/popular', GameController.getPopularGames);
router.get('/new', GameController.getNewGames);

// Game detail routes
router.get('/:gameId', GameController.getGameById);
router.get('/:gameId/stats', GameController.getGameStats);

// Game session routes
router.post('/:gameId/start', authenticateUser, GameController.startGameSession);
router.post('/:gameId/end', authenticateUser, GameController.endGameSession);
router.get('/:gameId/sessions', authenticateUser, GameController.getGameSessions);
router.get('/:gameId/sessions/:sessionId', authenticateUser, GameController.getGameSessionById);

// Game action routes
router.post('/:gameId/bet', authenticateUser, GameController.placeBet);
router.post('/:gameId/spin', authenticateUser, GameController.spin);
router.post('/:gameId/deal', authenticateUser, GameController.deal);
router.post('/:gameId/hit', authenticateUser, GameController.hit);
router.post('/:gameId/stand', authenticateUser, GameController.stand);
router.post('/:gameId/double', authenticateUser, GameController.double);
router.post('/:gameId/split', authenticateUser, GameController.split);

// Game settings routes
router.get('/:gameId/settings', authenticateUser, GameController.getGameSettings);
router.put('/:gameId/settings', authenticateUser, GameController.updateGameSettings);

// Game favorite routes
router.post('/:gameId/favorite', authenticateUser, GameController.addToFavorites);
router.delete('/:gameId/favorite', authenticateUser, GameController.removeFromFavorites);

module.exports = router;
