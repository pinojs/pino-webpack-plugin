'use strict'

const { readFileSync, readdirSync } = require('fs')
const { resolve } = require('path')
const { test } = require('tap')
const webpack = require('webpack')
const { banner, footer, PinoWebpackPlugin } = require('../src/index')
const execa = require('execa')

test('it should correctly generated all required pino files whe using explicit import', (t) => {
  t.plan(16)

  const distFolder = t.testdir()

  webpack(
    {
      context: resolve(__dirname, 'fixtures'),
      mode: 'production',
      target: 'node',
      entry: {
        third: './third.mjs'
      },
      output: {
        path: distFolder,
        filename: '[name]-[contenthash].js'
      },
      plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })],
      optimization: {
        minimize: false
      }
    },
    (err, stats) => {
      t.error(err)
      t.notOk(stats.hasErrors())

      // Find all files in the folder
      const rootFiles = readdirSync(distFolder).filter((e) => e.endsWith('.js'))

      const thirdFile = rootFiles.find((e) => e.startsWith('third-'))
      const threadStream = rootFiles.find((e) => e.startsWith('thread-stream-'))
      const pinoWorker = rootFiles.find((e) => e.startsWith('pino-worker-'))
      const pinoPipelineWorker = rootFiles.find((e) => e.startsWith('pino-pipeline-worker-'))
      const pinoFile = rootFiles.find((e) => e.startsWith('pino-file-'))
      const pinoPretty = rootFiles.find((e) => e.startsWith('pino-pretty-'))

      // Check that all required files have been generated
      t.ok(thirdFile)
      t.ok(threadStream)
      t.ok(pinoWorker)
      t.ok(pinoPipelineWorker)
      t.ok(pinoFile)
      t.ok(pinoPretty)

      // Check that generated pino related files have the right footer
      for (const file of [threadStream, pinoWorker, pinoPipelineWorker, pinoFile, pinoPretty]) {
        t.ok(readFileSync(resolve(distFolder, file), 'utf-8').endsWith(footer))
      }

      // Check that the root file starts with the banner and has the right path to pino-file
      const thirdContent = readFileSync(resolve(distFolder, thirdFile), 'utf-8')
      t.ok(thirdContent.startsWith(banner))
      t.ok(
        thirdContent.includes(
          `globalThis.__bundlerPathsOverrides = {'pino/file': pinoWebpackAbsolutePath('./${pinoFile}')`
        )
      )

      execa(process.argv[0], [resolve(distFolder, thirdFile)]).then(({ stdout }) => {
        t.match(stdout, /This is third!/)
      })
    }
  )
})
