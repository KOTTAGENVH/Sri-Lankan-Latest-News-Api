// not-found.filter.ts

import { ExceptionFilter, Catch, NotFoundException } from '@nestjs/common';
import { HttpException, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Customize your error response here
    response.status(404).json({
      statusCode: 404,
      message: 'Resource Not Found',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
