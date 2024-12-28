const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    user: 'casino_admin',
    host: '137.184.43.236',
    database: 'casino',
    password: '6996',
    port: 5432,
});

async function createSuperAdmin() {
    const client = await pool.connect();
    try {
        // Create admins table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                role VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Check if superadmin already exists
        const existingAdmin = await client.query(
            'SELECT * FROM admins WHERE role = $1',
            ['superadmin']
        );

        if (existingAdmin.rows.length > 0) {
            console.log('Superadmin already exists');
            return;
        }

        // Create superadmin account
        const username = 'superadmin';
        const password = 'goldwave123!'; // You should change this immediately after first login
        const email = 'admin@goldwavecasino.com';

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert superadmin
        await client.query(
            'INSERT INTO admins (username, password, email, role) VALUES ($1, $2, $3, $4)',
            [username, hashedPassword, email, 'superadmin']
        );

        console.log('Superadmin account created successfully');
        console.log('Username:', username);
        console.log('Password:', password);
        console.log('Please change the password immediately after first login');

    } catch (error) {
        console.error('Error creating superadmin:', error);
    } finally {
        client.release();
    }
}

// Run the setup
createSuperAdmin().finally(() => {
    pool.end();
}); 