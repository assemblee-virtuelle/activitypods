const { ControlledContainerMixin } = require('@semapps/ldp');
const { OBJECT_TYPES, ActivitiesHandlerMixin } = require('@semapps/activitypub');
const { CREATE_COMMENT } = require('../config/patterns');
const { CREATE_COMMENT_MAPPING } = require('../config/mappings');

module.exports = {
  name: 'comments.comment',
  mixins: [ControlledContainerMixin, ActivitiesHandlerMixin],
  settings: {
    path: '/comments',
    acceptedTypes: [OBJECT_TYPES.NOTE],
    permissions: {},
    newResourcesPermissions: {
      anon: { read: true }
    },
  },
  dependencies: ['activitypub.registry', 'activity-mapping'],
  async started() {
    // TODO also attach to offers/requests
    await this.broker.call('activitypub.registry.register', {
      path: '/replies',
      attachToTypes: Object.values(OBJECT_TYPES),
      attachPredicate: 'https://www.w3.org/ns/activitystreams#replies',
      ordered: true,
      dereferenceItems: true,
    });

    await this.broker.call('activity-mapping.addMapper', {
      match: CREATE_COMMENT,
      mapping: CREATE_COMMENT_MAPPING,
      priority: 2 // Before regular new messages
    });
  },
  activities: {
    postComment: {
      match: CREATE_COMMENT,
      async onEmit(ctx, activity, emitterUri) {
        // TODO check that emitter has the right to see the object

        // TODO get the ACL of the object inReplyTo

        console.log('activity.object.inReplyTo', activity.object.inReplyTo);

        await ctx.call('activitypub.collection.attach', { collectionUri: activity.object.inReplyTo.replies, item: activity.object.id })
      }
    },
  },
};
