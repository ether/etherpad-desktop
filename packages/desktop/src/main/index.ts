import { boot } from './app/lifecycle.js';
boot().catch((err) => {
  console.error('failed to boot', err);
  process.exit(1);
});
