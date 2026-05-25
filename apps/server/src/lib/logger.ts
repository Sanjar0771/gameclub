export const log = {
  info: (msg: string, meta?: unknown) => {
    console.log(`[INFO ${new Date().toISOString()}] ${msg}`, meta ?? '');
  },
  warn: (msg: string, meta?: unknown) => {
    console.warn(`[WARN ${new Date().toISOString()}] ${msg}`, meta ?? '');
  },
  error: (msg: string, err?: unknown) => {
    console.error(`[ERROR ${new Date().toISOString()}] ${msg}`, err ?? '');
  },
  debug: (msg: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG ${new Date().toISOString()}] ${msg}`, meta ?? '');
    }
  },
};
