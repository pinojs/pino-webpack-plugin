'use strict'

const { test } = require('tap')

const { createTests } = require('./test-utils')

const { PinoWebpackPlugin } = require('../src/index')

test('it should correctly generated all required pino files with explicit import', (t) => {
  const webpackConfig = {
    entry: {
      third: './third.mjs'
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

  // const distFolder = t.testdir()

  runBuild(() => {
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

    // const thirdFile = rootFiles.find((e) => e.startsWith('third-'))
    // const threadStream = rootFiles.find((e) => e.startsWith('thread-stream-'))
    // const pinoWorker = rootFiles.find((e) => e.startsWith('pino-worker-'))
    // const pinoPipelineWorker = rootFiles.find((e) => e.startsWith('pino-pipeline-worker-'))
    // const pinoFile = rootFiles.find((e) => e.startsWith('pino-file-'))
    // const pinoPretty = rootFiles.find((e) => e.startsWith('pino-pretty-'))

    // Check that all required files have been generated
    // t.ok(thirdFile)
    // t.ok(threadStream)
    // t.ok(pinoWorker)
    // t.ok(pinoPipelineWorker)
    // t.ok(pinoFile)
    // t.ok(pinoPretty)

    // Check that generated pino related files have the right footer
    for (const file of Object.values(dependencies)) {
      testDependencyFileHasFooter(file)
    }

    // Check that the root file starts with the banner and has the right path to pino-file
    testEntrypointFile(thirdFile, dependencies, 'This is third!')
    // const thirdContent = readFileSync(resolve(distFolder, thirdFile), 'utf-8')
    // t.ok(thirdContent.startsWith(banner))
    // t.ok(
    //   thirdContent.includes(
    //     `globalThis.__bundlerPathsOverrides = {'pino/file': pinoWebpackAbsolutePath('./${pinoFile}')`
    //   )
    // )

    // execa(process.argv[0], [resolve(distFolder, thirdFile)]).then(({ stdout }) => {
    //   t.match(stdout, /This is third!/)
    // })
  })
})
