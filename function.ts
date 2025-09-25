import * as Sentry from '@sentry/aws-serverless';
import type { Handler } from 'aws-lambda';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

export let handler: Handler = async function(event, context) {
    Sentry.captureMessage("This always gets reported");
    await Sentry.flush(2000);
    throw new Error("This only gets reported if using Sentry.wrapHandler()");
    return JSON.stringify({ message: "Hello from Lambda!" });
}

if (process.env.USE_SENTRY_WRAPPER) {
    handler = Sentry.wrapHandler(handler)
}