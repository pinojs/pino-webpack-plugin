'use strict'

const { readFileSync, readdirSync } = require('fs')
const { resolve } = require('path')
const { test } = require('tap')
const webpack = require('webpack')
const { banner, footer, PinoWebpackPlugin } = require('../src/index')
const execa = require('execa')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

function runBuild(distFolder, onDone) {
  webpack(
    {
      context: resolve(__dirname, 'fixtures'),
      mode: 'production',
      target: 'node',
      entry: {
        first: './first.js',
        'abc/cde/second': './second.js'
      },
      output: {
        path: distFolder,
        filename: '[name]-[contenthash].js'
      },
      plugins: [new CleanWebpackPlugin(), new PinoWebpackPlugin({ transports: ['pino-pretty'] })],
      optimization: {
        minimize: false
      }
    },
    onDone
  )
}

test('it should correctly generate all required pino files when the cache is enabled on Webpack', (t) => {
  t.plan(29)

  const distFolder = t.testdir()

  runBuild(distFolder, (err, stats) => {
    t.error(err)
    t.notOk(stats.hasErrors())

    // Find all files in the folder
    const rootFiles = readdirSync(distFolder).filter((e) => e.endsWith('.js'))
    const nestedFiles = readdirSync(resolve(distFolder, 'abc/cde')).filter((e) => e.endsWith('.js'))

    const firstFile = rootFiles.find((e) => e.startsWith('first-'))
    const secondFile = nestedFiles.find((e) => e.startsWith('second-'))
    const threadStream = rootFiles.find((e) => e.startsWith('thread-stream-'))
    const pinoWorker = rootFiles.find((e) => e.startsWith('pino-worker-'))
    const pinoPipelineWorker = rootFiles.find((e) => e.startsWith('pino-pipeline-worker-'))
    const pinoFile = rootFiles.find((e) => e.startsWith('pino-file-'))
    const pinoPretty = rootFiles.find((e) => e.startsWith('pino-pretty-'))

    // Check that all required files have been generated
    t.ok(firstFile)
    t.ok(secondFile)
    t.ok(threadStream)
    t.ok(pinoWorker)
    t.ok(pinoPipelineWorker)
    t.ok(pinoFile)
    t.ok(pinoPretty)

    runBuild(distFolder, (err, stats) => {
      t.error(err)
      t.notOk(stats.hasErrors())

      // Find all files in the folder
      const rootFiles = readdirSync(distFolder).filter((e) => e.endsWith('.js'))
      const nestedFiles = readdirSync(resolve(distFolder, 'abc/cde')).filter((e) => e.endsWith('.js'))

      const firstFile = rootFiles.find((e) => e.startsWith('first-'))
      const secondFile = nestedFiles.find((e) => e.startsWith('second-'))
      const threadStream = rootFiles.find((e) => e.startsWith('thread-stream-'))
      const pinoWorker = rootFiles.find((e) => e.startsWith('pino-worker-'))
      const pinoPipelineWorker = rootFiles.find((e) => e.startsWith('pino-pipeline-worker-'))
      const pinoFile = rootFiles.find((e) => e.startsWith('pino-file-'))
      const pinoPretty = rootFiles.find((e) => e.startsWith('pino-pretty-'))

      // Check that all required files have been generated
      t.ok(firstFile)
      t.ok(secondFile)
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
      const firstContent = readFileSync(resolve(distFolder, firstFile), 'utf-8')
      t.ok(firstContent.startsWith(banner))
      t.ok(
        firstContent.includes(
          `globalThis.__bundlerPathsOverrides = {'pino/file': pinoWebpackAbsolutePath('./${pinoFile}')`
        )
      )

      execa(process.argv[0], [resolve(distFolder, firstFile)]).then(({ stdout }) => {
        t.match(stdout, /This is first!/)
      })

      const secondDistFilePath = resolve(distFolder, `abc/cde/${secondFile}`)

      // Check that the root file starts with the banner and has the right path to pino-file
      const secondContent = readFileSync(secondDistFilePath, 'utf-8')
      t.ok(secondContent.startsWith(banner))
      t.ok(secondContent.includes(`'pino-pretty': pinoWebpackAbsolutePath('../../${pinoPretty}')`))

      execa(process.argv[0], [resolve(secondDistFilePath)]).then(({ stdout }) => {
        t.match(stdout, /This is second!/)
      })
    })
  })
})
