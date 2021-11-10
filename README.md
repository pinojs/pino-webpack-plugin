# pino-webpack-plugin

[![Package Version](https://img.shields.io/npm/v/pino-webpack-plugin.svg)](https://npm.im/pino-webpack-plugin)
[![Dependency Status](https://img.shields.io/librariesio/release/npm/pino-webpack-plugin)](https://libraries.io/npm/pino-webpack-plugin)
[![Build](https://github.com/pinojs/pino-webpack-plugin/workflows/CI/badge.svg)](https://github.com/pinojs/pino-webpack-plugin/actions?query=workflow%3ACI)

A pino plugin for webpack.

## Installation

Just run:

```bash
npm install pino-webpack-plugin
```

## Description

This plugin allows to use of pino v7 with webpack generated bundle files.

Note that, due to pino architecture (based on Node.js' Worker Threads), it is not possible to make it work _without_ generating extra files.

This means that when using this plugin the following list of files will be generated at the root of your dist folder:

- `thread-stream.js`
- `pino-worker.js`
- `pino-pipeline-worker.js`
- `pino-file.js`
- A file for each transport you specify in the plugin constructor's `transports` option. (see below)

Each of the additional file is a bundle and therefore does not contain any external dependency, but it is needed to use pino and it must be included in the deployment.

## Usage

Simply include the plugin in your webpack configuration.
Make sure you provide the plugin a list of all the pino transports you use via the `transports` option (`pino/file` is always included so no need to specify it).

```js
const { PinoWebpackPlugin } = require('pino-webpack-plugin')

module.exports = {
  entry: 'index.js',
  plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
}
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

Copyright Paolo Insogna and pino-webpack-plugin contributors 2021. Licensed under the [MIT License](http://www.apache.org/licenses/MIT).
