'use strict'

const { test } = require('tap')

const { createTests } = require('./test-utils')

const { PinoWebpackPlugin } = require('../src/index')

test('should work in webpack development mode', (t) => {
  const webpackConfig = {
    mode: 'development',
    entry: {
      main: './second.js'
    },
    plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
  }

  const { runBuild, testEntrypointFile } = createTests(t, webpackConfig)

  t.plan(4)

  runBuild(() => {
    testEntrypointFile('main.js', {}, 'This is second!')
  })
})
