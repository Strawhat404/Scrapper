import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS - allows frontend (port 8080) to call backend (port 3000)
  app.enableCors({
    origin: true,  // Allow all origins for development
    credentials: true,  // Allow cookies/auth headers
  });
  
  await app.listen(process.env.PORT ?? 3000);
  console.log('🚀 Backend running on http://localhost:3000');
}
bootstrap();
