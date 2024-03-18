const { AuthAccountService } = require('@semapps/auth');
const { TripleStoreAdapter } = require('@semapps/triplestore');
const CONFIG = require('../config/config');

// We import only this sub-service as we need it for the bot
// The WebFinger service currently relies on this service to identify unique users
module.exports = {
  mixins: [AuthAccountService],
  adapter: new TripleStoreAdapter({ type: 'AuthAccount', dataset: CONFIG.AUTH_ACCOUNTS_DATASET_NAME })
};
