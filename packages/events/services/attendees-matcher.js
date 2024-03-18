const { MIME_TYPES } = require('@semapps/mime-types');
const { ACTIVITY_TYPES } = require('@semapps/activitypub');
const { getSlugFromUri, arrayOf } = require('@semapps/ldp');
const { POST_EVENT_CONTACT_REQUEST, POST_EVENT_ACCEPT_CONTACT_REQUEST } = require('../config/patterns');
const { POST_EVENT_CONTACT_REQUEST_MAPPING } = require('../config/mappings');

module.exports = {
  name: 'events.attendees-matcher',
  dependencies: ['activity-mapping'],
  async started() {
    await this.broker.call('activity-mapping.addMapper', {
      match: POST_EVENT_CONTACT_REQUEST,
      mapping: POST_EVENT_CONTACT_REQUEST_MAPPING,
      priority: 2 // Before regular contact requests
    });
    await this.broker.call('activity-mapping.addMapper', {
      match: POST_EVENT_ACCEPT_CONTACT_REQUEST,
      mapping: false, // Ignore activity
      priority: 2 // Before regular accept contact requests
    });
  },
  events: {
    async 'events.status.finished'(ctx) {
      const { eventUri } = ctx.params;
      const event = await ctx.call('events.event.get', {
        resourceUri: eventUri,
        accept: MIME_TYPES.JSON,
        webId: 'system'
      });

      const collection = await ctx.call('activitypub.collection.get', {
        collectionUri: event['apods:attendees'],
        webId: 'system'
      });

      // Save meta data before modifying them temporarily
      const savedMeta = { ...ctx.meta };

      for (let attendeeUri of arrayOf(collection.items)) {
        ctx.meta.webId = attendeeUri;
        ctx.meta.dataset = getSlugFromUri(attendeeUri);

        const attendee = await ctx.call('activitypub.actor.get', { actorUri: attendeeUri });

        let potentialNewContacts = [];
        for (let otherAttendeeUri of arrayOf(collection.items).filter(uri => uri !== attendeeUri)) {
          const alreadyConnected = await ctx.call('activitypub.collection.includes', {
            collectionUri: attendee['apods:contacts'],
            itemUri: otherAttendeeUri
          });
          if (!alreadyConnected) potentialNewContacts.push(otherAttendeeUri);
        }

        if (potentialNewContacts.length > 0) {
          await ctx.call('activitypub.outbox.post', {
            collectionUri: attendee.outbox,
            type: ACTIVITY_TYPES.OFFER,
            actor: attendee.id,
            object: {
              type: ACTIVITY_TYPES.ADD,
              object: attendee.url
            },
            context: event.id,
            target: potentialNewContacts,
            to: potentialNewContacts
          });
        }
      }

      // Restore metadata
      ctx.meta = savedMeta;
    }
  }
};
