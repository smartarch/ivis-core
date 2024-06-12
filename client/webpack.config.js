const webpack = require('webpack');
const path = require('path');

console.log("dirname" + __dirname);
module.exports = {
    mode: 'development',
    entry: {
        'index-trusted': ['core-js/stable', 'regenerator-runtime/runtime', './src/root-trusted.js'],
        'index-sandbox': ['core-js/stable', 'regenerator-runtime/runtime', './src/root-sandbox.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: path.join(__dirname, 'node_modules'),
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    targets: {
                                        "chrome": "58",
                                        "edge": "15",
                                        "firefox": "55",
                                        "ios": "10"
                                    }
                                }],
                                '@babel/preset-react'
                            ],
                            plugins: [
                                ["@babel/plugin-proposal-decorators", {"legacy": true}],
                                ["@babel/plugin-transform-class-properties", {"loose": true}],
                                ["@babel/plugin-transform-private-methods", {"loose": true}],
                                ["@babel/plugin-transform-private-property-in-object", { "loose": true }],
                                "@babel/plugin-proposal-function-bind",
                                "@babel/plugin-transform-optional-chaining"
                            ]
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                localIdentName: '[name]__[local]___[hash:base64:5]',
                            },
                        }
                    },
                ]
            },
            {
                test: /\.(png|jpg|gif|woff2?)$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192 // inline base64 URLs for <=8k images, direct URLs for the rest
                        }
                    }
                ]
            },
            {
                test: /(@fortawesome)\/.*\.svg$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192 // inline base64 URLs for <=8k images, direct URLs for the rest
                        }
                    }
                ]
            },
            {
                test: /\.scss$/,
                exclude: path.join(__dirname, 'node_modules'),
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                localIdentName: '[path][name]__[local]--[hash:base64:5]'
                            }
                        }
                    },
                    'sass-loader',
                ]
            },
            {
                test: /\.(ttf|eot)$/,
                use: ['file-loader']
            }
        ]
    },
    externals: {
        jquery: 'jQuery',
        csrfToken: 'csrfToken',
        ivisConfig: 'ivisConfig'
    },
    plugins: [
//        new webpack.optimize.UglifyJsPlugin()
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
    watchOptions: {
        ignored: 'node_modules/',
        poll: 1000
    },
    resolve: {
        fallback: {
            "buffer": require.resolve("buffer/"),
        }
    },
    devtool: "source-map",
};
