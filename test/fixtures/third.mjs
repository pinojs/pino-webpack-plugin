import pino from 'pino'
import 'pino-pretty'

const logger = pino(
  pino.transport({
    target: 'pino-pretty'
  })
)

logger.info('This is third!')
