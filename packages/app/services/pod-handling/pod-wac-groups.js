const FetchPodOrProxyMixin = require('../../mixins/fetch-pod-or-proxy');

module.exports = {
  name: 'pod-wac-groups',
  mixins: [FetchPodOrProxyMixin],
  actions: {
    async get(ctx) {
      const { groupUri, groupSlug, actorUri } = ctx.params;

      const { body, status } = await this.actions.fetch({
        url: groupUri || this.getGroupUri(groupSlug, actorUri),
        headers: {
          Accept: 'application/ld+json'
        },
        actorUri
      });

      return status === 200 ? body : false;
    },
    async list(ctx) {
      const { actorUri } = ctx.params;
      const { origin, pathname } = new URL(actorUri);

      const { body, status } = await this.actions.fetch({
        url: `${origin}/_groups${pathname}`,
        headers: {
          Accept: 'application/ld+json'
        },
        actorUri
      });

      return status === 200 ? body : false;
    },
    async create(ctx) {
      const { groupSlug, actorUri } = ctx.params;
      const { origin, pathname } = new URL(actorUri);

      const { headers } = await this.actions.fetch({
        url: `${origin}/_groups${pathname}`,
        method: 'POST',
        headers: {
          Slug: groupSlug
        },
        actorUri
      });

      return headers.location;
    },
    async delete(ctx) {
      const { groupUri, groupSlug, actorUri } = ctx.params;

      const { status } = await this.actions.fetch({
        url: groupUri || this.getGroupUri(groupSlug, actorUri),
        method: 'DELETE',
        actorUri
      });

      return status === 204;
    },
    async addMember(ctx) {
      const { groupUri, groupSlug, memberUri, actorUri } = ctx.params;

      const { status } = await this.actions.fetch({
        url: groupUri || this.getGroupUri(groupSlug, actorUri),
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memberUri }),
        actorUri
      });

      return status === 204;
    },
    async removeMember(ctx) {
      const { groupUri, groupSlug, memberUri, actorUri } = ctx.params;

      const { status } = await this.actions.fetch({
        url: groupUri || this.getGroupUri(groupSlug, actorUri),
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deleteUserUri: memberUri }),
        actorUri
      });

      return status === 204;
    }
  },
  methods: {
    // Return URL like http://localhost:3000/_groups/alice/contacts
    getGroupUri(groupSlug, podOwner) {
      const { origin, pathname } = new URL(podOwner);
      return `${origin}/_groups${pathname}/${groupSlug}`;
    }
  }
};
