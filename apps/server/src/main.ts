import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set "api" prefix for REST routes (optional, can remove if not needed)
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Allow CORS for production hosts
  // IMPORTANT: change '*' to your frontend domain when deployed
  app.enableCors({
    origin: process.env.CLIENT_ORIGIN || '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Cloud hosts (Render, Fly.io) inject PORT as a string
  const port = Number(process.env.PORT) || 3000;

  await app.listen(port, '0.0.0.0');
  
  Logger.log(`🚀 Server listening on port ${port}`);
  Logger.log(`🌐 REST API prefix: /${globalPrefix}`);
  Logger.log(`🎮 WebSocket ready at ws://<your-domain>:${port}`);
}

bootstrap();
