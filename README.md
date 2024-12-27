# Goldwave Casino

A modern web-based casino application featuring various games including slots and blackjack. Built with JavaScript and modern web technologies.

## Features

-   🎰 Modern Slot Machine

    -   Multiple paylines
    -   Wild symbols, scatter symbols, and bonus rounds
    -   Free spins feature
    -   Dynamic win animations
    -   Configurable bet amounts ($0.20 - $5.00)
    -   Auto-spin functionality

-   🎮 Responsive Design
    -   Works on desktop and mobile devices
    -   Smooth animations and transitions
    -   Modern UI/UX

## Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   npm (v6 or higher)
-   MongoDB (v4.4 or higher)
-   Redis (v6 or higher)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/jwillz7667/GoldwaveCasino55.git
    cd GoldwaveCasino55
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Set up environment variables:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` file and update the following configurations:
    - MongoDB connection settings
    - Redis connection settings
    - JWT secrets
    - Email configuration (if needed)
    - External service API keys (if needed)

4. Start MongoDB and Redis:
    ```bash
    # Start MongoDB (using brew services on macOS)
    brew services start mongodb-community
    
    # Start Redis (using brew services on macOS)
    brew services start redis
    ```

5. Start the development server:

    ```bash
    npm run dev
    ```

6. Open your browser and navigate to:
    ```
    http://localhost:3000
    ```

### API Documentation

When `ENABLE_SWAGGER=true` in your `.env`, you can access the API documentation at:
```
http://localhost:3000/api-docs
```

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Game Rules

### Slot Machine

-   Minimum bet: $0.20
-   Maximum bet: $5.00
-   Wild symbol (🃏) substitutes for any symbol except Scatter and Bonus
-   3 or more Scatter symbols (⭐) award 10 free spins
-   3 or more Bonus symbols (🎁) trigger the bonus round
-   Multiple paylines available for more winning combinations

## Technologies Used

-   JavaScript (ES6+)
-   Node.js & Express
-   MongoDB
-   Redis
-   JWT Authentication
-   WebSocket for real-time features
-   Webpack
-   CSS3 with Animations
-   HTML5

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

-   Inspired by modern casino games
-   Built with love for gaming enthusiasts
