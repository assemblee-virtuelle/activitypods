const fetch = require('node-fetch');
const urlJoin = require('url-join');
const { ControlledContainerMixin, useFullURI, defaultToArray } = require('@semapps/ldp');
const { MIME_TYPES } = require('@semapps/mime-types');
const CONFIG = require('../config/config');
const ontologies = require('../config/ontologies.json');

module.exports = {
  name: 'core.front-apps',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/front-apps',
    acceptedTypes: ['apods:FrontAppRegistration'],
    excludeFromMirror: true,
    permissions: {},
    newResourcesPermissions: {}
  },
  async started() {
    const res = await fetch('https://data.activitypods.org/trusted-apps', {
      headers: { Accept: 'application/ld+json' }
    });

    if (res.ok) {
      const data = await res.json();
      this.trustedApps = data['ldp:contains'];
    } else {
      throw new Error('Unable to fetch https://data.activitypods.org/trusted-apps');
    }

    // POD provider app
    if (CONFIG.FRONTEND_URL) {
      this.trustedApps.push({
        'apods:domainName': new URL(CONFIG.FRONTEND_URL).host,
        'apods:handledTypes': [
          'http://www.w3.org/2006/vcard/ns#Individual',
          'https://www.w3.org/ns/activitystreams#Profile',
          'http://www.w3.org/2006/vcard/ns#Location',
          'http://activitypods.org/ns/core#FrontAppRegistration'
        ]
      });
    }

    await this.broker.call('api.addRoute', {
      route: {
        name: 'open-app-endpoint',
        path: '/:username/openApp',
        authorization: false,
        authentication: false,
        aliases: {
          'GET /': 'core.front-apps.open'
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

      if (!type.startsWith('http')) type = useFullURI(type, ontologies);

      const results = await ctx.call('triplestore.query', {
        query: `
          PREFIX apods: <http://activitypods.org/ns/core#>
          SELECT ?domainName
          WHERE {
            ?registration a apods:FrontAppRegistration .
            ?registration apods:preferredForTypes <${type}> .
            ?registration apods:domainName ?domainName .
          }
        `,
        dataset: username,
        webId: 'system'
      });

      if (!results.length) throw new Error(`No app associated with type ${type}`);

      const domainName = results[0].domainName.value;

      const protocol = domainName.includes(':') ? 'http' : 'https';
      if (uri) {
        ctx.meta.$statusCode = 302;
        ctx.meta.$location = `${protocol}://${domainName}/r/?type=${encodeURIComponent(type)}&uri=${encodeURIComponent(
          uri
        )}&mode=${mode || 'show'}`;
      } else {
        ctx.meta.$statusCode = 302;
        ctx.meta.$location = `${protocol}://${domainName}/r/?type=${encodeURIComponent(type)}&mode=${mode || 'list'}`;
      }
    },
    async addMissingApps(ctx) {
      for (let dataset of await ctx.call('pod.list')) {
        ctx.meta.dataset = dataset;
        this.logger.info('Adding front apps to dataset ' + dataset + '...');
        const [account] = await ctx.call('auth.account.find', { query: { username: dataset } });

        for (let app of this.trustedApps) {
          if (!app['apods:locales'] || defaultToArray(app['apods:locales']).includes(account.preferredLocale)) {
            const appUri = urlJoin(CONFIG.HOME_URL, dataset, 'data', 'front-apps', app['apods:domainName']);
            const exists = await ctx.call('ldp.resource.exist', {
              resourceUri: appUri,
              webId: 'system'
            });

            if (exists) {
              this.logger.info(`${appUri} already exists, updating...`);

              await this.actions.put(
                {
                  resource: {
                    id: appUri,
                    type: 'apods:FrontAppRegistration',
                    'apods:domainName': app['apods:domainName'],
                    'apods:preferredForTypes': app['apods:handledTypes'],
                    'apods:application':
                      app.type === 'apods:TrustedApps'
                        ? `https://${app['apods:domainName']}/application.json`
                        : undefined
                  },
                  contentType: MIME_TYPES.JSON,
                  webId: urlJoin(CONFIG.HOME_URL, dataset)
                },
                { parentCtx: ctx }
              );
            } else {
              await this.actions.post(
                {
                  resource: {
                    type: 'apods:FrontAppRegistration',
                    'apods:domainName': app['apods:domainName'],
                    'apods:preferredForTypes': app['apods:handledTypes'],
                    'apods:application': app.id
                  },
                  contentType: MIME_TYPES.JSON,
                  slug: app['apods:domainName'],
                  webId: urlJoin(CONFIG.HOME_URL, dataset)
                },
                { parentCtx: ctx }
              );

              this.logger.info(`${appUri} added!`);
            }
          }
        }
      }
    },
    async list(ctx) {
      return this.trustedApps;
    }
  },
  events: {
    async 'auth.registered'(ctx) {
      const { webId, accountData } = ctx.params;
      const containerUri = await this.actions.getContainerUri({ webId }, { parentCtx: ctx });

      await this.actions.waitForContainerCreation({ containerUri }, { parentCtx: ctx });

      for (let app of this.trustedApps) {
        // Only add applications which match the account preferred locale
        if (!app['apods:locales'] || defaultToArray(app['apods:locales']).includes(accountData.preferredLocale)) {
          await this.actions.post(
            {
              resource: {
                type: 'apods:FrontAppRegistration',
                'apods:domainName': app['apods:domainName'],
                'apods:preferredForTypes': app['apods:handledTypes'],
                'apods:application':
                  app.type === 'apods:TrustedApps' ? `https://${app['apods:domainName']}/application.json` : undefined
              },
              contentType: MIME_TYPES.JSON,
              slug: app['apods:domainName'],
              webId
            },
            { parentCtx: ctx }
          );
        }
      }
    }
  }
};
