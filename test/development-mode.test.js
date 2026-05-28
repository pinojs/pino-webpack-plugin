'use strict'

const test = require('node:test')
const { createTests } = require('./test-utils')
const { PinoWebpackPlugin } = require('../src/index')

test('should work in webpack development mode', async (t) => {
  const webpackConfig = {
    mode: 'development',
    entry: {
      main: './second.js'
    },
    plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
  }

  const { runBuild, testEntrypointFile } = createTests(t, webpackConfig)

  t.plan(4)

  await runBuild(async () => {
    await testEntrypointFile('main.js', {}, 'This is second!')
  })
})
