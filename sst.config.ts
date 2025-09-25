import { SSTConfig } from "sst";
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda';
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
          NODE_OPTIONS: "--import ./instrument.js",
        },
        runtime: Runtime.NODEJS_22_X,
        bundling: {
          format: OutputFormat.ESM,
          nodeModules: ['@sentry/aws-serverless'],
          commandHooks: {
            beforeBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },
            beforeInstall(): string[] {
              return [];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              // copy extra file into output
              return [`cp ${inputDir}/instrument.js ${inputDir}/package.json ${outputDir}`];
            },
          },
        },
      });
      const fnUrl = fn.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });

      stack.addOutputs({
        FunctionUrl: fnUrl.url,
      });
    });
  }
} satisfies SSTConfig;
