import { expectType } from 'tsd'
import { WebpackPluginInstance } from 'webpack'
import { PinoWebpackPlugin, banner, footer } from '../..'

expectType<WebpackPluginInstance>(
  new PinoWebpackPlugin({
    transports: ['pino-pretty']
  })
)
expectType<string>(banner)
expectType<string>(footer)
