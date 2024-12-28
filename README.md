# Casino Platform

A full-featured online casino platform with user management, game integration, and administrative capabilities.

## Features

### User Features
- User registration and authentication
- Balance management
- Game access and play
- Transaction history
- Real-time balance updates

### Admin Features
- Secure admin dashboard
- User management (create, view, update status)
- Game management
- Transaction monitoring
- Revenue reporting
- User activity tracking

### Technical Features
- Secure authentication system
- PostgreSQL database integration
- Real-time updates
- Responsive design
- Session management

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd casino
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create database and user
psql postgres
CREATE USER casino_admin WITH PASSWORD '6996';
CREATE DATABASE casino;
GRANT ALL PRIVILEGES ON DATABASE casino TO casino_admin;

# Initialize database schema
psql -U casino_admin -d casino -f scripts/init-db.sql
```

4. Create a superadmin account:
```bash
node scripts/setup-admin.js
```

## Development

Start the development server:
```bash
npm run dev
```

This will start:
- Backend server on port 3001
- Frontend development server on port 8080

## Usage

### User Interface
- Access the main casino interface at: `http://localhost:8080`
- Login with your user credentials
- Browse and play available games
- View transaction history and balance

### Admin Interface
- Access the admin dashboard at: `http://localhost:8080/admin`
- Login with superadmin credentials:
  - Username: superadmin
  - Password: goldwave123!
- Manage users, games, and view reports

## Project Structure

```
casino/
├── server/           # Backend server code
├── src/              # Frontend source code
│   ├── js/          # JavaScript files
│   ├── css/         # Stylesheets
│   └── assets/      # Static assets
├── public/          # Static files
├── dist/            # Built files
├── scripts/         # Database and setup scripts
└── webpack.config.js # Webpack configuration
```

## Security Notes

- Change the superadmin password immediately after first login
- Keep the database credentials secure
- Regular security audits recommended
- Session management implemented
- Password hashing using bcrypt

## License

[Your License]
