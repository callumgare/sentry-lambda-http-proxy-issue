import type { Handler } from 'aws-lambda';

export let handler: Handler = async function(event, context) {
    throw new Error("An uncaught error from Lambda");
}