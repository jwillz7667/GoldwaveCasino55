export class AdminUsers {
    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users');
            if (!response.ok) {
                throw new Error('Failed to load users');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading users:', error);
            return [];
        }
    }

    async updateUser(userId, data) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Failed to update user');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    async deleteUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete user');
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
} 