const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for node built-ins (required by crypto libs)
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "process": require.resolve('process/browser'), // Make sure fallback points to browser version
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/"), // Ensure trailing slash
        "util": require.resolve("util/"),     // Ensure trailing slash
        "assert": require.resolve("assert/"),   // Ensure trailing slash
        "vm": require.resolve("vm-browserify"), // Added vm polyfill
        // Add any other node built-ins your dependencies might need
        // "http": require.resolve("stream-http"),
        // "https": require.resolve("https-browserify"),
        // "os": require.resolve("os-browserify/browser"),
        // "url": require.resolve("url/"),
      };

      // Provide global variables expected by some libraries
      webpackConfig.plugins = (webpackConfig.plugins || []).concat([
        new webpack.ProvidePlugin({
          process: 'process',
          Buffer: 'buffer', // Simplified Buffer provision
        }),
      ]);

      // Ignore warnings about source maps from node_modules libraries if they become noisy
      webpackConfig.ignoreWarnings = [...(webpackConfig.ignoreWarnings || []), /Failed to parse source map/];

      return webpackConfig;
    },
  },
}; 