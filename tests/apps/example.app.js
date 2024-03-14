const { AppService } = require('@activitypods/app');
const { AS_PREFIX } = require('@semapps/activitypub');
const CONFIG = require('../config');

module.exports = {
  mixins: [AppService],
  settings: {
    app: {
      name: 'Example App',
      description: 'An ActivityPods app for integration tests'
    },
    accessNeeds: {
      required: [
        {
          registeredClass: AS_PREFIX + 'Event',
          accessMode: ['acl:Read', 'acl:Write', 'acl:Control']
        },
        'apods:ReadInbox',
        'apods:PostOutbox',
        'apods:SendNotification',
        'apods:CreateAclGroup'
      ],
      optional: [
        {
          registeredClass: AS_PREFIX + 'Place',
          accessMode: ['acl:Read', 'acl:Append']
        }
      ]
    },
    classDescriptions: {
      'as:Event': {
        label: {
          en: 'Events',
          fr: 'Evénements'
        },
        labelPredicate: 'as:name',
        openEndpoint: 'https://example.app/r'
      }
    },
    queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
  }
};
