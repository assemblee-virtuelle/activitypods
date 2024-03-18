const { AppService } = require('@activitypods/app');
const { AS_PREFIX } = require('@semapps/activitypub');
const CONFIG = require('../config');

module.exports = {
  mixins: [AppService],
  settings: {
    app: {
      name: 'Example 2 App',
      description: 'Another ActivityPods app for integration tests'
    },
    accessNeeds: {
      required: [
        {
          registeredClass: AS_PREFIX + 'Event',
          accessMode: ['acl:Read', 'acl:Write']
        }
      ],
      optional: [
        {
          registeredClass: AS_PREFIX + 'Place',
          accessMode: ['acl:Read', 'acl:Append']
        }
      ]
    },
    queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
  }
};
