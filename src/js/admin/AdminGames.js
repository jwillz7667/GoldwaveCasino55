export class AdminGames {
    async loadGames() {
        try {
            const response = await fetch('/api/admin/games');
            if (!response.ok) {
                throw new Error('Failed to load games');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading games:', error);
            return [];
        }
    }

    async updateGame(gameId, data) {
        try {
            const response = await fetch(`/api/admin/games/${gameId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Failed to update game');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating game:', error);
            throw error;
        }
    }

    async toggleGameStatus(gameId) {
        try {
            const response = await fetch(`/api/admin/games/${gameId}/toggle`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to toggle game status');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error toggling game status:', error);
            throw error;
        }
    }
} 