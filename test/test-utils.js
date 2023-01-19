const execa = require('execa')
const { readdirSync, readFileSync } = require('fs')
const { resolve, relative, dirname, basename, join } = require('path')
const { webpack } = require('webpack')

const { banner, footer, PinoWebpackPlugin } = require('../src/index')

function createTests(tapInstance, webpackConfig, distFolder) {
  // If no dist folder, use tap tempfolder
  distFolder ??= tapInstance.testdir()

  // Update webpack config with distFolder
  webpackConfig.output ??= {}
  webpackConfig.output.path = distFolder

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

  // Default dependencies to estimate test plan
  const DEFAULT_DEPENDENCIES = ['pino-worker', 'pino/file', 'thread-stream-worker', 'pino-pipeline-worker']

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
      webpack({ ...DEFAULT_WEBPACK_CONFIG, ...webpackConfig }, (err, stats) => {
        tapInstance.error(err, 'Webpack run should have no error')
        tapInstance.notOk(stats.hasErrors(), 'Webpack compilation stats should have no error')
        callback(err, stats)
      })
    },

    /**
     * Test if file exists, and if only one file exists starting with given pattern
     * @return First found file relative path to distFolder
     */
    testJSFileExists: function (pattern, subFolder) {
      const folderFiles = readdirSync(resolve(distFolder, subFolder ?? '')).filter((f) => f.startsWith(pattern))
      tapInstance.ok(
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
      tapInstance.ok(readFileSync(filePath, 'utf8').endsWith(footer), `${file} should have compatibility footer`)
    },

    // Test entry file
    testEntrypointFile: function (filePath, dependencies, expectedOutput) {
      const fileContent = readFileSync(resolve(distFolder, filePath), 'utf-8')
      // Test if the file starts with the expected banner
      tapInstance.ok(fileContent.startsWith(banner), `${basename(filePath)} should starts with banner`)
      for (const dependencyKey in dependencies) {
        // For each dependency, test if the expeted file is in the __bundlerPathsOverrides object
        const dependencyRegexp = new RegExp(
          `globalThis\\.__bundlerPathsOverrides = \\{.*?'${dependencyKey}': pinoWebpackAbsolutePath\\('${
            (relative(dirname(filePath), dirname(dependencies[dependencyKey])) || '.') +
            '/' +
            dependencies[dependencyKey]
          }'\\).*?\\}`
        )
        tapInstance.ok(fileContent.match(dependencyRegexp), `${dependencyKey} should have correct path in ${filePath}`)
      }
      // Test expected file output
      execa(process.argv[0], [resolve(distFolder, filePath)]).then(({ stdout }) => {
        tapInstance.match(stdout, expectedOutput, `${filePath} should output "${expectedOutput}"`)
      })
    }
  }
}

module.exports = {
  createTests
}
