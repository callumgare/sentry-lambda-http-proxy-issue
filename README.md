A sentry issue reproduction test case.

To deploy first install dependencies with `npm install` then run:

```bash
export AWS_PROFILE="<name of aws profile to use>"
export SENTRY_DSN="<sentry dsn url>"
export USE_SENTRY_WRAPPER= # set to "true" to test with the sentry handler wrapper applied 
npm run deploy -- --region "<aws region you want to deploy to>"
```