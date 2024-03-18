const { PodActivitiesHandlerMixin } = require('@activitypods/app');

module.exports = {
  name: 'invite',
  mixins: [PodActivitiesHandlerMixin],
  activities: {
    invite: {
      match: {
        type: 'Invite',
        object: {
          type: 'Event'
        }
      },
      async onReceive(ctx, activity, actorUri) {
        console.log('Detected event invitation !', activity);

        await ctx.call('pod-notifications.send', {
          template: {
            title: {
              en: `{{emitterProfile.vcard:given-name}} invites you to an event "{{activity.object.name}}"`,
              fr: `{{emitterProfile.vcard:given-name}} vous invite à une rencontre "{{activity.object.name}}"`
            },
            actions: [
              {
                caption: {
                  en: 'View',
                  fr: 'Voir'
                },
                link: '/Event/{{encodeUri activity.object.id}}/show'
              }
            ]
          },
          activity,
          context: activity.object.id,
          recipientUri: actorUri
        });
      }
    }
  }
};
