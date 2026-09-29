const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ContractService } = require('../dist/modules/contract/contract.service');

async function test() {
  console.log('Initializing NestJS application context...');
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    console.log('Application context initialized.');
    const service = app.get(ContractService);
    console.log('Calling getActiveConfig()...');
    const result = await service.getActiveConfig();
    console.log('Result:', result);
    await app.close();
  } catch (err) {
    console.error('FAIL:', err);
  }
}

test();
