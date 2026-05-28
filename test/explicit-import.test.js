'use strict'

const test = require('node:test')
const { createTests } = require('./test-utils')
const { PinoWebpackPlugin } = require('../src/index')

test('it should correctly generated all required pino files with explicit import', async (t) => {
  const webpackConfig = {
    entry: {
      third: './third.mjs'
    },
    output: {
      filename: '[name]-[contenthash].js'
    },
    plugins: [new PinoWebpackPlugin({ transports: ['pino-pretty'] })]
  }

  const { planEstimation, runBuild, testJSFileExists, testDependencyFileHasFooter, testEntrypointFile } = createTests(
    t,
    webpackConfig
  )

  t.plan(planEstimation)

  await runBuild(async () => {
    const thirdFile = testJSFileExists('third-')

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

    // Check that the root file starts with the banner and has the right path to pino-file
    await testEntrypointFile(thirdFile, dependencies, 'This is third!')
  })
})
