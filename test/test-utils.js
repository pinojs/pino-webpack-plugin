'use strict'

const { mkdirSync, readdirSync, readFileSync } = require('node:fs')
const { resolve, relative, dirname, basename, join } = require('node:path')
const { rm } = require('node:fs/promises')
const crypto = require('node:crypto')
const os = require('node:os')
const execa = require('execa')
const { webpack } = require('webpack')

const { banner, footer, PinoWebpackPlugin } = require('../src/index')

// Default dependencies to estimate test plan
const DEFAULT_DEPENDENCIES = ['pino-worker', 'pino/file', 'thread-stream-worker', 'pino-pipeline-worker']

// Default webpack config, will be merged with webpackConfig parameter
const DEFAULT_WEBPACK_CONFIG = {
  context: resolve(__dirname, 'fixtures'),
  mode: 'production',
  target: 'node',
  output: {
    filename: '[name]-[contenthash].js'
  },
  optimization: {
    minimize: false
  }
}

function createTests (t, webpackConfig, distFolder) {
  // If no dist folder, use tap tempfolder
  distFolder = distFolder ?? testdir()

  // Update webpack config with distFolder
  webpackConfig.output = webpackConfig.output ?? {}
  webpackConfig.output.path = distFolder

  let dependenciesCount = DEFAULT_DEPENDENCIES.length
  const entryPointCount = Object.values(webpackConfig.entry).length

  // Count plugin(s) transports
  if (webpackConfig.plugins?.length) {
    for (const plugin of webpackConfig.plugins.filter((p) => p instanceof PinoWebpackPlugin)) {
      dependenciesCount += plugin.transports.length
    }
  }

  /**
   * Compilation errors are tested *2 (runtime, compilation)
   *
   * Each entry point should be planned *(3+dependenciesCount):
   * - file exists
   * - starts with banner
   * - dependencies are here (*transportCount)
   * - file output is OK
   *
   * Each dependency (transport/module) should be planned *2
   * - file exists (+1)
   * - has compatibility footer (+1)
   */
  const planEstimation = 2 + dependenciesCount * 2 + entryPointCount * (3 + dependenciesCount)

  return {
    // Output folder
    distFolder,
    // Test plan estimation
    planEstimation,

    // Run webpack build, then test errors
    runBuild: function (callback) {
      return new Promise((resolve, reject) => {
        webpack({ ...DEFAULT_WEBPACK_CONFIG, ...webpackConfig }, (err, stats) => {
          t.assert.ifError(err, 'Webpack run should have no error')
          t.assert.equal(stats.hasErrors(), false, 'Webpack compilation stats should have no error')
          Promise.resolve(callback(err, stats)).then(resolve).catch(reject)
        })
      })
    },

    /**
     * Test if file exists, and if only one file exists starting with given pattern
     * @return First found file relative path to distFolder
     */
    testJSFileExists: function (pattern, subFolder) {
      const folderFiles = readdirSync(resolve(distFolder, subFolder ?? '')).filter((f) => f.startsWith(pattern))
      t.assert.ok(
        folderFiles.length === 1,
        `/${subFolder ?? ''} has ${folderFiles.length} file${
          folderFiles.length === 1 ? 's' : ''
        } matching ${pattern} (${folderFiles.join(',')})`
      )
      return join(subFolder ?? '', folderFiles[0])
    },

    // Test if dependency file has compatibility footer
    testDependencyFileHasFooter: function (file, subFolder) {
      const filePath = subFolder ? resolve(distFolder, subFolder, file) : resolve(distFolder, file)
      t.assert.ok(readFileSync(filePath, 'utf8').endsWith(footer), `${file} should have compatibility footer`)
    },

    // Test entry file
    testEntrypointFile: function (filePath, dependencies, expectedOutput) {
      const fileContent = readFileSync(resolve(distFolder, filePath), 'utf-8')
      // Test if the file starts with the expected banner
      t.assert.ok(fileContent.startsWith(banner), `${basename(filePath)} should starts with banner`)
      const quoteRegex = (path) => `'${path.replace(/\\/g, '\\\\\\\\')}'`
      for (const dependencyKey in dependencies) {
        // For each dependency, test if the expected file is in the __bundlerPathsOverrides object
        const dependencyRegexp = new RegExp(
          `globalThis\\.__bundlerPathsOverrides = \\{.*?'${dependencyKey}': pinoWebpackAbsolutePath\\(${
            quoteRegex(
              join(
                relative(dirname(filePath), dirname(dependencies[dependencyKey])),
                dependencies[dependencyKey]
              )
            )
          }\\).*?\\}`
        )
        t.assert.ok(fileContent.match(dependencyRegexp), `${dependencyKey} should have correct path in ${filePath}`)
      }
      // Test expected file output
      return execa(process.argv[0], [resolve(distFolder, filePath)]).then(({ stdout }) => {
        t.assert.match(stdout, new RegExp(expectedOutput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${filePath} should output "${expectedOutput}"`)
      })
    }
  }
}

function testdir () {
  const parent = join(os.tmpdir(), crypto.randomBytes(16).toString('hex'))
  mkdirSync(parent)
  return parent
}

async function removeDir (target) {
  return rm(target, { force: true, recursive: true })
}

module.exports = {
  createTests,
  testdir,
  removeDir
}
