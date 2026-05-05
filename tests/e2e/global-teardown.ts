import { stopAllEtherpads } from './fixtures/etherpad.js';

async function globalTeardown(): Promise<void> {
  await stopAllEtherpads();
}

export default globalTeardown;
