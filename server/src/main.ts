import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './helper/all_exception_filter';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const port = 8223;

    app.useGlobalFilters(new AllExceptionsFilter());

    await app.listen(port);
    console.log(`Server is running on http://localhost:${port}`);
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

bootstrap();
