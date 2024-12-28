export class AdminDashboard {
    async loadStats() {
        try {
            const response = await fetch('/api/admin/stats');
            if (!response.ok) {
                throw new Error('Failed to load dashboard stats');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            return {
                users: { current: 0, change: 0 },
                games: { current: 0, change: 0 },
                revenue: { current: 0, change: 0 },
                sessions: { current: 0, change: 0 }
            };
        }
    }

    async loadRecentActivities() {
        try {
            const response = await fetch('/api/admin/activities');
            if (!response.ok) {
                throw new Error('Failed to load recent activities');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading recent activities:', error);
            return [];
        }
    }
} 