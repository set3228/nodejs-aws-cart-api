import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as serverless from 'serverless-http';

let server: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (_req, callback) => callback(null, true),
  });

  app.use(helmet());

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  server = serverless(expressApp);
}

export const handler = async (event, context) => {
  if (!server) {
    await bootstrap();
  }
  return server(event, context);
};
