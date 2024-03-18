const { useFullURI } = require('@semapps/ldp');

const POD_PROVIDER_TYPES = [
  'http://www.w3.org/2006/vcard/ns#Individual',
  'https://www.w3.org/ns/activitystreams#Profile',
  'http://www.w3.org/2006/vcard/ns#Location',
  'http://www.w3.org/ns/solid/interop#ApplicationRegistration'
];

module.exports = {
  name: 'app-opener',
  settings: {
    frontendUrl: null
  },
  dependencies: ['api'],
  async started() {
    await this.broker.call('api.addRoute', {
      route: {
        name: 'open-app-endpoint',
        path: '/:username/openApp',
        authorization: false,
        authentication: false,
        aliases: {
          'GET /': 'app-opener.open'
        }
      }
    });
  },
  actions: {
    async open(ctx) {
      let { type, uri, mode, username } = ctx.params;

      // If resource type is not provided, guess it from the resource
      if (!type && uri) {
        const results = await ctx.call('triplestore.query', {
          query: `
            SELECT ?type
            WHERE {
              <${uri}> a ?type .
            }
          `,
          dataset: username,
          webId: 'system'
        });

        if (results.length === 0) throw new Error('Resource not found ' + uri);

        // TODO do a search with all types associated with the resource
        type = results[0].type.value;
      }

      if (!type) throw new Error('The type or URI must be provided');

      if (!type.startsWith('http')) type = useFullURI(type, this.settings.ontologies);

      let appUri;
      if (POD_PROVIDER_TYPES.includes(type)) {
        appUri = this.settings.frontendUrl;
      } else {
        const results = await ctx.call('triplestore.query', {
          query: `
            PREFIX interop: <http://www.w3.org/ns/solid/interop#>
            PREFIX apods: <http://activitypods.org/ns/core#>
            SELECT ?appUri
            WHERE {
              ?registration a interop:DataGrant .
              ?registration apods:registeredClass <${type}> .
              ?registration interop:grantee ?appUri .
            }
          `,
          dataset: username,
          webId: 'system'
        });

        if (!results.length) throw new Error(`No app associated with type ${type}`);

        appUri = results[0].appUri.value;
      }

      const appBaseUrl = new URL(appUri).origin;

      if (uri) {
        ctx.meta.$statusCode = 302;
        ctx.meta.$location = `${appBaseUrl}/r/?type=${encodeURIComponent(type)}&uri=${encodeURIComponent(uri)}&mode=${
          mode || 'show'
        }`;
      } else {
        ctx.meta.$statusCode = 302;
        ctx.meta.$location = `${appBaseUrl}/r/?type=${encodeURIComponent(type)}&mode=${mode || 'list'}`;
      }
    }
  }
};
