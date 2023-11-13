const urlJoin = require('url-join');
const { AppService } = require('@activitypods/app');
const { AS_PREFIX } = require('@semapps/activitypub');
const CONFIG = require('../config/config');

module.exports = {
  mixins: [AppService],
  settings: {
    app: {
      name: 'Example App',
      description: 'An ActivityPods-compatible app',
      thumbnail: urlJoin(CONFIG.FRONT_URL, 'logo192.png')
    },
    accessNeeds: {
      required: [
        {
          registeredClass: AS_PREFIX + 'Event',
          accessMode: ['acl:Read', 'acl:Create']
        },
        {
          registeredClass: 'http://www.w3.org/2006/vcard/ns#Individual',
          accessMode: 'acl:Read'
        },
        'apods:ReadInbox',
        'apods:ReadOutbox'
      ],
      optional: ['apods:SendNotification']
    }
  }
};