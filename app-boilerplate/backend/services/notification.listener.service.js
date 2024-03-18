const { TripleStoreAdapter } = require('@semapps/triplestore');
const { NotificationListenerService } = require('@activitypods/solid-notifications');
const CONFIG = require('../config/config');

module.exports = {
  mixins: [NotificationListenerService],
  adapter: new TripleStoreAdapter({ type: 'WebhookChannelListener', dataset: CONFIG.AUTH_ACCOUNTS_DATASET_NAME }),
  settings: {
    baseUrl: CONFIG.HOME_URL
  }
};
