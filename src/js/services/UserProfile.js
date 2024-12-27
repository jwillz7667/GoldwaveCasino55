export class UserProfile {
    constructor() {
        this.userData = null;
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/user/profile');
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            return await response.json();
        } catch (error) {
            throw new Error('Failed to load user data');
        }
    }

    getData() {
        return this.userData;
    }

    async updateBalance(amount) {
        try {
            const response = await fetch('/api/user/balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount }),
            });
            if (!response.ok) {
                throw new Error('Failed to update balance');
            }
            return await response.json();
        } catch (error) {
            throw new Error('Failed to update balance');
        }
    }

    async updateProfile(data) {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error('Failed to update profile');
            }
            return await response.json();
        } catch (error) {
            throw new Error('Failed to update profile');
        }
    }

    async getGameHistory() {
        try {
            const response = await fetch('/api/user/game-history', {
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to load game history');

            return await response.json();
        } catch (error) {
            throw new Error('Failed to load game history');
        }
    }

    async getTransactionHistory() {
        try {
            const response = await fetch('/api/user/transactions', {
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to load transaction history');

            return await response.json();
        } catch (error) {
            throw new Error('Failed to load transactions');
        }
    }
}
