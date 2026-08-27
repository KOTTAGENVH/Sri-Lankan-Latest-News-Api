import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './helper/all_exception_filter';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const port = 8223;

    app.useGlobalFilters(new AllExceptionsFilter());

    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-RapidAPI-Key',
        'API_KEY',
        // 'EMBEDDING_API_KEY',
      ],
    });
    await app.listen(port);
    console.log(`Server is running on http://localhost:${port}`);
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

bootstrap();
