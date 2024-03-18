// Read all .env* files in the root folder and add them to process.env
// See https://github.com/kerimdzhanov/dotenv-flow for more details
require('dotenv-flow').config();

module.exports = {
  HOME_URL: process.env.SEMAPPS_HOME_URL,
  FRONT_URL: process.env.SEMAPPS_FRONT_URL,
  PORT: process.env.SEMAPPS_PORT,
  SPARQL_ENDPOINT: process.env.SEMAPPS_SPARQL_ENDPOINT,
  MAIN_DATASET: process.env.SEMAPPS_MAIN_DATASET,
  JENA_USER: process.env.SEMAPPS_JENA_USER,
  JENA_PASSWORD: process.env.SEMAPPS_JENA_PASSWORD,
  JSON_CONTEXT: process.env.SEMAPPS_JSON_CONTEXT,
  REDIS_CACHE_URL: process.env.SEMAPPS_REDIS_CACHE_URL,
  QUEUE_SERVICE_URL: process.env.SEMAPPS_QUEUE_SERVICE_URL,
  AUTH_ACCOUNTS_DATASET_NAME: process.env.SEMAPPS_AUTH_ACCOUNTS_DATASET_NAME
};
