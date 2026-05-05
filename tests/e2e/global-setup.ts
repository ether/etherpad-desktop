import { startEtherpad } from './fixtures/etherpad.js';

async function globalSetup(): Promise<void> {
  await startEtherpad();
}

export default globalSetup;
