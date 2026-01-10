import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    // REST
    if (context.getType() === 'http') {
      return super.getRequestResponse(context);
    }

    // GraphQL
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();

    return {
      req: ctx.req,
      res: ctx.res,
    };
  }
}
