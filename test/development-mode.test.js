'use strict'

const { resolve } = require('path')
const { test } = require('tap')
const webpack = require('webpack')
const { PinoWebpackPlugin } = require('../src/index')
const execa = require('execa')

function runBuild(distFolder, onDone) {
  webpack(
    {
      context: resolve(__dirname, 'fixtures'),
      mode: 'development',
      target: 'node',
      entry: {
        main: './second.js'
      },
      output: {
        path: distFolder
      },
      plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
    },
    onDone
  )
}

test('should work in webpack development mode', (t) => {
  t.plan(3)

  const distFolder = t.testdir()

  runBuild(distFolder, (err, stats) => {
    t.error(err)
    t.notOk(stats.hasErrors())

    execa(process.argv[0], [resolve(distFolder, 'main.js')]).then(({ stdout }) => {
      t.match(stdout, /This is second!/)
    })
  })
})
