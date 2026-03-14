'use strict'

const test = require('node:test')
const { join } = require('node:path')
const { createTests, testdir, removeDir } = require('./test-utils')

const { PinoWebpackPlugin } = require('../src/index')

test('it should correctly generate all required pino files when the cache is enabled on Webpack', (t, end) => {
  const distFolder = testdir()

  const webpackConfig = {
    entry: {
      first: './first.js',
      'abc/cde/second': './second.js'
    },
    output: {
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
    plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
  }

  const { planEstimation, runBuild, testJSFileExists, testDependencyFileHasFooter, testEntrypointFile } = createTests(
    t,
    webpackConfig,
    distFolder
  )

  t.plan(planEstimation + 2)

  t.after(async () => {
    await removeDir(distFolder)
  })

  runBuild(() => {
    t.diagnostic('Launch second build')
    runBuild(() => {
      const firstFile = testJSFileExists('first-')
      const secondFile = testJSFileExists('second-', 'abc/cde')

      const threadStream = testJSFileExists('thread-stream-')
      const pinoWorker = testJSFileExists('pino-worker-')
      const pinoPipelineWorker = testJSFileExists('pino-pipeline-worker-')
      const pinoFile = testJSFileExists('pino-file-')
      const pinoPretty = testJSFileExists('pino-pretty-')

      const dependencies = {
        'pino/file': pinoFile,
        'thread-stream-worker': threadStream,
        'pino-worker': pinoWorker,
        'pino-pipeline-worker': pinoPipelineWorker,
        'pino-pretty': pinoPretty
      }

      // Check that generated pino related files have the right footer
      for (const file of Object.values(dependencies)) {
        testDependencyFileHasFooter(file)
      }

      testEntrypointFile(firstFile, dependencies, 'This is first')
      testEntrypointFile(secondFile, dependencies, 'This is second')

      end()
    })
  })
})
