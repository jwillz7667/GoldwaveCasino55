export class AdminAuth {
    async checkAuth() {
        try {
            const response = await fetch('/api/admin/auth/check');
            if (!response.ok) {
                return false;
            }
            const data = await response.json();
            return data.isAuthenticated;
        } catch (error) {
            console.error('Error checking auth:', error);
            return false;
        }
    }

    async login(credentials) {
        try {
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            localStorage.setItem('adminToken', data.token);
            return true;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/admin/auth/logout', {
                method: 'POST'
            });
            localStorage.removeItem('adminToken');
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }
} 