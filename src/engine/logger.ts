import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'verbose'),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.errors({ stack: true }),
      ),
    }),
  ],
});

// ugh https://github.com/winstonjs/winston/issues/1338#issuecomment-474650102
logger.error = (item: any) => {
  const message = item instanceof Error ? item.stack ?? item.message : item;
  logger.log({ level: 'error', message });
  return logger;
};

export default logger;
