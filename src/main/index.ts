import { boot } from './app/lifecycle.js';
boot().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('failed to boot', err);
  process.exit(1);
});
