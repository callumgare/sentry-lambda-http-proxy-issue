import { SSTConfig } from "sst";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export default {
  config(_input) {
    return {
      name: "sentry-lambda-http-proxy-issue",
    };
  },
  stacks(app) {
    app.stack(({stack}) => {
      const fn = new NodejsFunction(stack, 'sentry-lambda-http-proxy-issue', {
        entry: path.join(import.meta.dirname, './function.ts'),
        handler: 'index.handler',
        environment: {
          SENTRY_DSN: process.env.SENTRY_DSN || '',
          SENTRY_DEBUG: 'true',
          USE_SENTRY_WRAPPER: process.env.USE_SENTRY_WRAPPER || '',
        }
      });
      const fnUrl = fn.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });

      stack.addOutputs({
        FunctionUrl: fnUrl.url,
      });
    });
  }
} satisfies SSTConfig;
