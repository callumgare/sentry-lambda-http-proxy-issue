A reproduction test case for https://github.com/getsentry/sentry-javascript/issues/17804.

To deploy first install dependencies with `npm install` then run:

```bash
export AWS_PROFILE="<name of aws profile to use>"
export SENTRY_DSN="<sentry dsn url>"
npm run deploy -- --region "<aws region you want to deploy to>"
```

Once deployed you should see some output text like this:
```
✔  Deployed:
   
   FunctionWithLayerUrl: https://1a2b3c.lambda-url.aws-region.on.aws/
   FunctionWithNpmUrl: https://c3b3a1.lambda-url.aws-region.on.aws/
```

Visiting the url for FunctionWithLayerUrl should result in no error message in sentry and a 403 Forbidden response from
the http proxy. But visiting FunctionWithNpmUrl should result in the error successfully being sent.   