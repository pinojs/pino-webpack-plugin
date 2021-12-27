'use strict'

const { spawnSync } = require('child_process')
const { readFileSync, readdirSync } = require('fs')
const { resolve, join } = require('path')
const { test } = require('tap')
const webpack = require('webpack')
const { banner, PinoWebpackPlugin } = require('../src/index')
const execa = require('execa')

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
      cache: {
        name: 'test',
        type: 'filesystem',
        cacheDirectory: join(distFolder, 'cache'),
        buildDependencies: {
          config: [__filename]
        }
      },
      plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })],
      optimization: {
        minimize: false
      }
    },
    onDone
  )
}

test('it should correctly generate all required pino files when the cache is enabled on Webpack', (t) => {
  t.plan(9)

  const distFolder = resolve(__dirname, '../tmp/cached-build')

  t.teardown(() => {
    spawnSync(`rm -rf ${distFolder}`, {
      shell: true
    })
  })

  runBuild(distFolder, (err) => {
    t.error(err)

    runBuild(distFolder, async (err, stats) => {
      t.error(err)
      t.notOk(stats.hasErrors())

      // Find all files in the folder
      const rootFiles = readdirSync(distFolder).filter((e) => e.endsWith('.js'))
      const nestedFiles = readdirSync(resolve(distFolder, 'abc/cde')).filter((e) => e.endsWith('.js'))

      const firstFile = rootFiles.find((e) => e.startsWith('first-'))
      const secondFile = nestedFiles.find((e) => e.startsWith('second-'))
      const pinoFile = rootFiles.find((e) => e.startsWith('pino-file-'))
      const pinoPretty = rootFiles.find((e) => e.startsWith('pino-pretty-'))

      // Check that the root file starts with the banner and has the right path to pino-file
      const firstContent = readFileSync(resolve(distFolder, firstFile), 'utf-8')
      t.ok(firstContent.startsWith(banner))
      t.ok(
        firstContent.includes(
          `globalThis.__bundlerPathsOverrides = {'pino/file': pinoWebpackAbsolutePath('./${pinoFile}')`
        )
      )
      const { stdout: firstStdout } = await execa(process.argv[0], [resolve(distFolder, firstFile)])

      t.match(firstStdout, /This is first!/)

      const secondDistFilePath = resolve(distFolder, `abc/cde/${secondFile}`)

      // Check that the root file starts with the banner and has the right path to pino-file
      const secondContent = readFileSync(secondDistFilePath, 'utf-8')
      t.ok(secondContent.startsWith(banner))
      t.ok(secondContent.includes(`'pino-pretty': pinoWebpackAbsolutePath('../../${pinoPretty}')`))

      const { stdout: secondStdout } = await execa(process.argv[0], [secondDistFilePath])

      t.match(secondStdout, /This is second!/)
    })
  })
})
