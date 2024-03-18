const { ControlledContainerMixin } = require('@semapps/ldp');
const { MIME_TYPES } = require('@semapps/mime-types');

module.exports = {
  name: 'profiles.location',
  mixins: [ControlledContainerMixin],
  settings: {
    acceptedTypes: ['vcard:Location'],
    excludeFromMirror: true,
    permissions: {},
    newResourcesPermissions: {}
  },
  actions: {
    async getHomeLocation(ctx) {
      const { webId } = ctx.params;

      const results = await ctx.call('triplestore.query', {
        query: `
          PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
          PREFIX as: <https://www.w3.org/ns/activitystreams#>
          SELECT ?homeLocation
          WHERE {
            <${webId}> as:url ?profile .
            ?profile vcard:hasAddress ?homeLocation .
          }
        `,
        accept: MIME_TYPES.JSON,
        webId
      });

      return results.length > 0 ? results[0].homeLocation.value : null;
    },
    async clearHomeLocation(ctx) {
      const { webId } = ctx.params;
      await ctx.call('triplestore.update', {
        query: `
          PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
          PREFIX as: <https://www.w3.org/ns/activitystreams#>
          DELETE {
            ?profile vcard:hasAddress ?homeLocation .
            ?hasGeo vcard:latitude ?latitude .
            ?hasGeo vcard:longitude ?longitude .
            ?profile vcard:hasGeo ?hasGeo .
          }
          WHERE {
            <${webId}> as:url ?profile .
            ?profile vcard:hasAddress ?homeLocation .
            ?profile vcard:hasGeo ?hasGeo .
            ?hasGeo vcard:latitude ?latitude .
            ?hasGeo vcard:longitude ?longitude .
          }
        `,
        webId
      });
    }
  },
  hooks: {
    after: {
      async delete(ctx, res) {
        // If the deleted location is the home location of the current user, clear it from profile
        const homeLocation = await this.actions.getHomeLocation({ webId: res.webId }, { parentCtx: ctx });
        if (homeLocation === res.resourceUri) {
          await this.actions.clearHomeLocation({ webId: res.webId }, { parentCtx: ctx });
        }
        return res;
      }
    }
  }
};
