const { ControlledContainerMixin, } = require('@semapps/ldp');
const { OBJECT_TYPES, ACTIVITY_TYPES, ActivitiesHandlerMixin } = require('@semapps/activitypub');
const { MIME_TYPES } = require("@semapps/mime-types");
const { ANNOUNCE_UPDATE_PROFILE } = require("../patterns");

module.exports = {
  name: 'contacts.profile',
  mixins: [ControlledContainerMixin, ActivitiesHandlerMixin],
  settings: {
    path: '/profiles',
    acceptedTypes: ['pair:Person', OBJECT_TYPES.PROFILE],
    permissions: {},
    newResourcesPermissions: {}
  },
  dependencies: ['activitypub', 'webacl'],
  actions: {
    async announceUpdate(ctx) {
      const { profileUri } = ctx.params;
      const updatedProfile = await ctx.call('activitypub.proxy.query', { objectUri: profileUri });
      const actor = await ctx.call('activitypub.actor.get', { actorUri: updatedProfile.describes });
      const contacts = await ctx.call('activitypub.collection.get', { collectionUri: actor['apods:contacts'], webId: actor.id });

      if( contacts.length > 0 ) {
        await ctx.call('activitypub.outbox.post', {
          collectionUri: actor.outbox,
          type: ACTIVITY_TYPES.ANNOUNCE,
          actor: actor.id,
          object: {
            type: ACTIVITY_TYPES.UPDATE,
            object: profileUri
          },
          to: contacts
        });
      }
    }
  },
  events: {
    async 'auth.registered'(ctx) {
      const { webId, profileData } = ctx.params;
      const containerUri = await this.getContainerUri(webId);

      await this.waitForContainerCreation(containerUri);

      const profileUrl = await this.actions.post({
        resource: {
          '@type': ['pair:Person', OBJECT_TYPES.PROFILE],
          'pair:label': profileData.familyName ? `${profileData.name} ${profileData.familyName.toUpperCase()}` : profileData.name,
          'pair:firstName': profileData.name,
          'pair:lastName': profileData.familyName,
          describes: webId,
        },
        containerUri,
        contentType: MIME_TYPES.JSON,
        webId
      });

      await ctx.call('ldp.resource.patch', {
        resource: {
          '@id': webId,
          url: profileUrl
        },
        contentType: MIME_TYPES.JSON,
        webId
      });
    }
  },
  activities: [
    {
      match: ANNOUNCE_UPDATE_PROFILE,
      async onReceive(ctx, activity, recipients) {
        for( let recipientUri of recipients ) {
          await ctx.call('activitypub.object.cacheRemote', {
            objectUri: activity.object.object.id,
            actorUri: recipientUri
          });
        }
      }
    }
  ],
  hooks: {
    after: {
      put(ctx, res) {
        this.actions.announceUpdate({ profileUri: res }, { parentCtx: ctx });
      },
      patch(ctx, res) {
        this.actions.announceUpdate({ profileUri: res }, { parentCtx: ctx });
      }
    }
  }
};
