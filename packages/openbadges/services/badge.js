const { ControlledContainerMixin } = require('@semapps/ldp');
const { getAnnouncesGroupUri } = require("@activitypods/announcer");

module.exports = {
  name: 'openbadges.badge',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/badges',
    acceptedTypes: ['BadgeClass'],
    dereference: ['obi:criteria'],
    permissions: {},
    newResourcesPermissions: { anon: { read: true } },
  },
  dependencies: ['activitypub.registry'],
  async started() {
    await this.broker.call('activitypub.registry.register', {
      path: '/recipients',
      attachToTypes: ['BadgeClass'],
      attachPredicate: 'https://w3id.org/openbadges#recipient',
      ordered: false,
      dereferenceItems: false,
    });
  },
  hooks: {
    after: {
      async create(ctx, res) {
        const { resourceUri } = res;

        await ctx.call('activitypub.object.awaitCreateComplete', {
          objectUri: resourceUri,
          predicates: ['recipient']
        });

        // Give anonymous read right to recipient collection
        await ctx.call('webacl.resource.addRights', {
          resourceUri,
          additionalRights: {
            anon: {
              read: true,
            },
          },
        });

        return res;
      }
    }
  }
};
