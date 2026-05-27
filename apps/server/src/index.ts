import { config } from './config.js';
import { log } from './lib/logger.js';
import { startApi } from './api/index.js';
import { startBot, stopBot } from './bot/index.js';
import { startCronJobs } from './jobs/index.js';

// BigInt ni JSON serialize qilish uchun (Prisma telegramId BigInt qaytaradi)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

process.env.TZ = config.TZ;

async function main() {
  log.info('🎮 GameClub server ishga tushmoqda...');
  log.info(`Vaqt zonasi: ${config.TZ}`);
  log.info(`Muhit: ${config.NODE_ENV}`);

  // API serverni ishga tushirish
  const apiApp = await startApi();

  // Bot (background)
  void startBot().catch((e) => {
    log.error('Bot ishga tushmadi', e);
  });

  // Cron jobs
  startCronJobs();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info(`${signal} signali — to'xtatmoqda...`);
    try {
      await stopBot();
      await apiApp.close();
    } catch (e) {
      log.error('Shutdown xato', e);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  log.error('Fatal error', e);
  process.exit(1);
});
