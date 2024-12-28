/* eslint-env node */
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => ({
    mode: argv.mode || 'development',
    entry: {
        admin: './src/js/admin.js',
        main: './src/js/main.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'js/[name].bundle.js',
        publicPath: '/',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'images/[name][ext]'
                }
            }
        ]
    },
    performance: {
        maxAssetSize: 1000000,
        maxEntrypointSize: 1000000,
        hints: 'warning'
    },
    optimization: {
        splitChunks: {
            chunks: 'all',
            minSize: 20000,
            maxSize: 244000,
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all'
                }
            }
        }
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'css/[name].css'
        }),
        new HtmlWebpackPlugin({
            template: './public/index.html',
            filename: 'index.html',
            chunks: ['main', 'vendors']
        }),
        new HtmlWebpackPlugin({
            template: './public/casino.html',
            filename: 'casino.html',
            chunks: ['main', 'vendors']
        }),
        new HtmlWebpackPlugin({
            template: './public/admin/login.html',
            filename: 'admin/login.html',
            chunks: ['admin', 'vendors']
        }),
        new HtmlWebpackPlugin({
            template: './public/admin/index.html',
            filename: 'admin/index.html',
            chunks: ['admin', 'vendors']
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/images',
                    to: 'images'
                }
            ]
        })
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist')
        },
        historyApiFallback: {
            rewrites: [
                { from: /^\/admin/, to: '/admin/index.html' },
                { from: /^\/casino/, to: '/casino.html' }
            ]
        },
        port: 8080,
        proxy: {
            '/api': 'http://localhost:3001'
        },
        hot: true,
        open: true
    }
});
