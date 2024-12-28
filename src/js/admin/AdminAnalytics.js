export class AdminAnalytics {
    async loadAnalytics() {
        try {
            const response = await fetch('/api/admin/analytics');
            if (!response.ok) {
                throw new Error('Failed to load analytics');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading analytics:', error);
            return {
                revenue: [],
                users: [],
                games: [],
                transactions: []
            };
        }
    }

    async getRevenueAnalytics(period = 'month') {
        try {
            const response = await fetch(`/api/admin/analytics/revenue?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load revenue analytics');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading revenue analytics:', error);
            return [];
        }
    }

    async getUserAnalytics(period = 'month') {
        try {
            const response = await fetch(`/api/admin/analytics/users?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load user analytics');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading user analytics:', error);
            return [];
        }
    }

    async getGameAnalytics(period = 'month') {
        try {
            const response = await fetch(`/api/admin/analytics/games?period=${period}`);
            if (!response.ok) {
                throw new Error('Failed to load game analytics');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading game analytics:', error);
            return [];
        }
    }
} 