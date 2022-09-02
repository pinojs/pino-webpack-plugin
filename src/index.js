const webpack = require('webpack')
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency')

const { sep } = require('path')

const banner = `/* Start of pino-webpack-plugin additions */
function pinoWebpackAbsolutePath(p) {
  try {
    return require('path').join(__dirname, p)
  } catch(e) {
    // This is needed not to trigger a warning if we try to use within CJS - Do we have another way?
    const f = new Function('p', 'return new URL(p, import.meta.url).pathname');
    return f(p)
  }
}
`

const footer = `
/* The following statement is added by pino-webpack-plugin to make sure extracted file are valid commonjs modules */
; if(typeof module !== 'undefined' && typeof __webpack_exports__ !== "undefined") { module.exports = __webpack_exports__; }
`

const CACHE_ID = 'pino-worker-plugin'

class PinoWebpackPlugin {
  constructor(options) {
    options = { transports: [], ...options }
    this.transports = options.transports
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('PinoWebpackPlugin', (compilation) => {
      const generatedPaths = {}
      const workers = {}

      // When requiring pino, thread-stream or users transports, prepare some required files for external bundling.
      compilation.hooks.buildModule.tap('PinoWebpackPlugin', this.trackInclusions.bind(this, workers))

      // When requiring pino, also make sure all transports in the options are required
      compilation.hooks.succeedModule.tap('PinoWebpackPlugin', (mod) => {
        if (mod.rawRequest !== 'pino') {
          return
        }

        for (const transport of this.transports) {
          mod.dependencies.push(new CommonJsRequireDependency(transport, null))
        }
      })

      // When webpack has finished analyzing and bundling all files, compile marked external files
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'PinoWebpackPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
        },
        (assets, callback) => {
          const childCompiler = this.createChildCompiler(compiler, compilation, workers)

          // When the files have been compiled, add a compatibility footer
          childCompiler.hooks.thisCompilation.tap('PinoWebpackPlugin', (childCompilation) => {
            childCompilation.hooks.processAssets.tapAsync(
              {
                name: 'PinoWebpackPlugin',
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
              },
              this.addCompatibilityFooter.bind(this)
            )
            // Add child compilation assets to the main compilation
            compilation.hooks.additionalAssets.tapAsync(
              'PinoWebpackPlugin',
              (compilation.assets = Object.assign(childCompilation.assets, compilation.assets))
            )
          })

          // Perform the compilation and then track each generated file relative path
          childCompiler.run((err, stats) => {
            /* c8 ignore next 3 */
            if (err) {
              return callback(err)
            }

            for (const id of Object.keys(workers)) {
              generatedPaths[id] = this.getGeneratedFile(stats.compilation, id)
            }

            this.handleCache(compiler, generatedPaths, callback)
          })
        }
      )

      compilation.hooks.processAssets.tapAsync(
        {
          name: 'PinoWebpackPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
        },
        this.addExternalFilesBanner.bind(this, generatedPaths)
      )
    })
  }

  handleCache(compiler, generatedPaths, callback) {
    // reference for cache https://github.com/webpack/webpack/blob/dc70535ef859e517e8659f87ca37f33261ad9092/lib/Cache.js
    const cache = compiler.getCache(CACHE_ID)

    // With this trick we are filling the missing entries to the generatedPaths
    // caused by the fact that the Webpack Cache is enabled
    // we are not invalidating cache because we are only filling what's missing
    cache.get(CACHE_ID, CACHE_ID, (err, data = {}) => {
      /* c8 ignore next 3 */
      if (err) {
        return callback(err)
      }

      for (const [id, fileName] of Object.entries(data)) {
        if (!generatedPaths[id]) {
          generatedPaths[id] = fileName
        }
      }

      cache.store(CACHE_ID, CACHE_ID, generatedPaths, callback)
    })
  }

  trackInclusions(workers, mod) {
    if (mod.rawRequest === 'thread-stream') {
      this.addExternalFile(workers, mod, 'thread-stream-worker', './lib/worker.js')
    } else if (mod.rawRequest === 'pino') {
      this.addExternalFile(workers, mod, 'pino/file', './file.js', 'pino-file')
      this.addExternalFile(workers, mod, 'pino-worker', './lib/worker.js')
      this.addExternalFile(workers, mod, 'pino-pipeline-worker', './lib/worker-pipeline.js')
    } else if (this.transports.includes(mod.rawRequest)) {
      workers[mod.rawRequest] = new webpack.EntryPlugin(mod.context, mod.request, {
        name: mod.rawRequest
      })
    }
  }

  addExternalFile(workers, mod, id, file, name) {
    if (!name) {
      name = id
    }

    workers[id] = new webpack.EntryPlugin(mod.context, file, { name })
  }

  getGeneratedFile(compilation, name) {
    if (name === 'pino/file') {
      name = 'pino-file'
    }

    const assets = compilation.entrypoints.get(name)

    /* c8 ignore next 3 */
    if (!assets) {
      return ''
    }

    const files = assets.getFiles() || /* c8 ignore next */ []

    return files[0] || /* c8 ignore next */ ''
  }

  createChildCompiler(compiler, compilation, workers) {
    // Create the compiler
    const childCompiler = compilation.createChildCompiler(
      'PinoWebpackPlugin',
      {
        library: {
          type: 'commonjs2'
        },
        iife: false
      },
      Object.values(workers)
    )
    childCompiler.inputFileSystem = compiler.inputFileSystem
    childCompiler.outputFileSystem = compiler.outputFileSystem

    // Enable required plugins
    new webpack.node.NodeTemplatePlugin({
      library: {
        type: 'commonjs2'
      },
      iife: false
    }).apply(childCompiler)
    new webpack.node.NodeTargetPlugin().apply(childCompiler)

    return childCompiler
  }

  addExternalFilesBanner(generatedPaths, assets, callback) {
    for (const path of Object.keys(assets)) {
      if (path.endsWith('.js')) {
        /*
          Find how much the asset is nested:
            * First of all we split the asset directory in the different levels
            * Each level means is then replaced with ".." as our external files are in the root of the build folder.
            * If no component was present, then it means the asset is root of the builder as well, so we just use ".".
        */
        const prefix =
          path
            .split(sep)
            .slice(0, -1)
            .map(() => '..')
            .join(sep) || '.'

        /*
          Create the __bundlerPathsOverrides variable by mapping each generatedPath to its relative location.
          We use a injected function to derive the absolute path at runtime.
        */
        const declarations = Object.entries(generatedPaths)
          .map(([id, path]) => `'${id}': pinoWebpackAbsolutePath('${prefix}${sep}${path}')`)
          .join(',')

        // Prepend the banner and the __bundlerPathsOverrides to the generated file.
        assets[path] = new webpack.sources.ConcatSource(
          banner,
          `\nglobalThis.__bundlerPathsOverrides = {${declarations}};\n/* End of pino-webpack-plugin additions */\n\n`,
          assets[path]
        )
      }
    }

    callback()
  }

  addCompatibilityFooter(childAssets, childCallback) {
    for (const path of Object.keys(childAssets)) {
      if (path.endsWith('.js')) {
        childAssets[path] = new webpack.sources.ConcatSource(childAssets[path], footer)
      }
    }

    childCallback()
  }
}

module.exports = {
  banner,
  footer,
  PinoWebpackPlugin
}
