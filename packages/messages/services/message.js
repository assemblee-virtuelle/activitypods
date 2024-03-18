const { ControlledContainerMixin, defaultToArray } = require('@semapps/ldp');
const { ACTIVITY_TYPES, OBJECT_TYPES, ActivitiesHandlerMixin } = require('@semapps/activitypub');

module.exports = {
  name: 'messages.message',
  mixins: [ControlledContainerMixin, ActivitiesHandlerMixin],
  settings: {
    acceptedTypes: 'as:Note',
    permissions: {},
    newResourcesPermissions: {}
  },
  activities: {
    createNote: {
      match: {
        type: ACTIVITY_TYPES.CREATE,
        object: {
          type: OBJECT_TYPES.NOTE
        }
      },
      async onEmit(ctx, activity, emitterUri) {
        // Ensure the recipients are in the contacts WebACL group of the emitter so they can see his profile (and respond him)
        for (let targetUri of defaultToArray(activity.to)) {
          await ctx.call('webacl.group.addMember', {
            groupSlug: new URL(emitterUri).pathname + '/contacts',
            memberUri: targetUri,
            webId: emitterUri
          });
        }
      },
      async onReceive(ctx, activity, recipientUri) {
        await ctx.call('mail-notifications.notify', {
          template: {
            title: {
              en: `{{{emitterProfile.vcard:given-name}}} sent you a message`,
              fr: `{{{emitterProfile.vcard:given-name}}} vous a envoyé un message`
            },
            content: '{{activity.object.content}}',
            actions: [
              {
                caption: {
                  en: 'Reply',
                  fr: 'Répondre'
                },
                link: '/Profile/{{encodeUri emitterProfile.id}}/show'
              }
            ]
          },
          recipientUri,
          activity,
          context: activity.object.id
        });
      }
    }
  }
};
