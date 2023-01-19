'use strict'

const { test } = require('tap')

const { createTests } = require('./test-utils')

const { PinoWebpackPlugin } = require('../src/index')

test('it should correctly generated all required pino files', (t) => {
  const webpackConfig = {
    entry: {
      first: './first.js',
      'abc/cde/second': './second.js'
    },
    output: {
      filename: '[name]-[contenthash].js'
    },
    plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
  }

  const { testPlan, runBuild, testJSFileExists, testDependencyFileHasFooter, testEntrypointFile } = createTests(
    t,
    webpackConfig
  )

  t.plan(testPlan)

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
  })
})
