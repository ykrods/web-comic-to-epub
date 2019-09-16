const path = require('path');
const { exec } = require('child_process');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  target: 'web',
  devtool: false,
  optimization: {
    minimize: false,
  },
  entry: {
    book: path.join(__dirname, 'src', 'book.js'),
    popup: path.join(__dirname, 'src', 'popup.js'),
    editor: path.join(__dirname, 'src', 'editor.js'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'popup.html',
      chunks: ['book', 'popup'],
      template: path.join(__dirname, 'src', 'templates', 'popup.html'),
    }),
    new HtmlWebpackPlugin({
      filename: 'editor.html',
      chunks: ['book', 'editor'],
      template: path.join(__dirname, 'src', 'templates', 'editor.html'),
    }),
    new CopyWebpackPlugin([
      // copy script to get last evaluated on chrome.tabs.executeScript
      {
        from: path.join(__dirname, 'src', 'extract.js'),
        to: 'extract.js'
      },
      {
        from: path.join(__dirname, 'src', 'manifest.json'),
        to: 'manifest.json',
        transform (content, path) {
          return content
        }
      },
      { from: path.join(__dirname, 'src', 'img'), to: 'img' },
      {
        from: path.join(__dirname, 'node_modules', 'mini.css', 'dist', 'mini-default.min.css'),
        to: 'mini-default.min.css',
      },
    ]),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
          exec('./node_modules/.bin/concat-licenses dist/notice_and_acknowledgement.txt --allowGuess --title="$(cat ./src/notice_header.txt)"', (err, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
          });
        });
      }
    },
  ],
};
