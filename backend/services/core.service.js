const path = require('path');
const urlJoin = require('url-join');
const { ActivityPubService, ActivityMappingService, ACTOR_TYPES, OBJECT_TYPES } = require('@semapps/activitypub');
const { AuthLocalService, AuthOIDCService } = require('@semapps/auth');
const { JsonLdService } = require('@semapps/jsonld');
const { LdpService, DocumentTaggerMixin } = require('@semapps/ldp');
const { PodService } = require('@semapps/pod');
const { SignatureService, ProxyService } = require('@semapps/signature');
const { SynchronizerService } = require('@semapps/sync');
const { SparqlEndpointService } = require('@semapps/sparql-endpoint');
const { TripleStoreService } = require('@semapps/triplestore');
const { WebAclService } = require('@semapps/webacl');
const { WebfingerService } = require('@semapps/webfinger');
const { WebIdService } = require('@semapps/webid');
const CONFIG = require('../config/config');
const containers = require('./config/containers');
const ontologies = require('./config/ontologies.json');
const transport = require('../config/transport');

const CoreService = {
  name: 'core',
  settings: {
    baseUrl: CONFIG.HOME_URL,
    baseDir: path.resolve(__dirname, '..'),
    frontendUrl: CONFIG.FRONTEND_URL,
    triplestore: {
      url: CONFIG.SPARQL_ENDPOINT,
      user: CONFIG.JENA_USER,
      password: CONFIG.JENA_PASSWORD
    },
    jsonContext: CONFIG.JSON_CONTEXT,
    queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
  },
  created() {
    let { baseUrl, baseDir, frontendUrl, triplestore, jsonContext, queueServiceUrl } = this.settings;

    // If an external JSON context is not provided, we will use a local one
    const localJsonContext = urlJoin(baseUrl, '_system', 'context.json');

    this.broker.createService(ActivityPubService, {
      settings: {
        baseUri: baseUrl,
        jsonContext: jsonContext || localJsonContext,
        containers,
        podProvider: true,
        dispatch: {
          queueServiceUrl
        },
        like: {
          attachToObjectTypes: [...Object.values(OBJECT_TYPES), 'pair:Skill'],
          attachToActorTypes: Object.values(ACTOR_TYPES)
        }
      }
    });

    this.broker.createService(CONFIG.AUTH_TYPE === 'local' ? AuthLocalService : AuthOIDCService, {
      settings: {
        baseUrl,
        jwtPath: path.resolve(baseDir, './jwt'),
        reservedUsernames: ['sparql', 'auth', 'common', 'data', 'settings', 'localData', 'testData'],
        webIdSelection: ['nick'],
        accountSelection: ['preferredLocale'],
        formUrl: frontendUrl ? urlJoin(frontendUrl, 'login') : undefined,
        reservedUsernames: CONFIG.AUTH_RESERVED_USER_NAMES,
        accountsDataset: CONFIG.AUTH_ACCOUNTS_DATASET,
        issuer: CONFIG.AUTH_OIDC_ISSUER,
        clientId: CONFIG.AUTH_OIDC_CLIENT_ID,
        clientSecret: CONFIG.AUTH_OIDC_CLIENT_SECRET,
        mail: {
          from: `${CONFIG.FROM_NAME} <${CONFIG.FROM_EMAIL}>`,
          transport,
          defaults: {
            locale: CONFIG.DEFAULT_LOCALE,
            frontUrl: CONFIG.FRONTEND_URL
          }
        }
      }
    });

    this.broker.createService(JsonLdService, {
      settings: {
        baseUri: baseUrl,
        localContextFiles: jsonContext
          ? undefined
          : [
              {
                path: '_system/context.json',
                file: path.resolve(__dirname, '../config/context.json')
              }
            ],
        remoteContextFiles: [
          {
            uri: 'https://www.w3.org/ns/activitystreams',
            file: path.resolve(__dirname, '../config/context-as.json')
          }
        ]
      }
    });

    this.broker.createService(LdpService, {
      mixins: [DocumentTaggerMixin],
      settings: {
        baseUrl,
        ontologies,
        podProvider: true,
        containers,
        resourcesWithContainerPath: true, // TODO try to set to false
        defaultContainerOptions: {
          jsonContext: jsonContext || localJsonContext,
          permissions: {},
          newResourcesPermissions: {}
        }
      }
    });

    this.broker.createService(PodService, {
      settings: {
        baseUrl
      }
    });

    // Required for notifications
    this.broker.createService(ActivityMappingService, {
      settings: {
        handlebars: {
          helpers: {
            encodeUri: uri => encodeURIComponent(uri)
          }
        }
      }
    });

    this.broker.createService(ProxyService, {
      settings: {
        podProvider: true
      }
    });

    this.broker.createService(SignatureService, {
      settings: {
        actorsKeyPairsDir: path.resolve(baseDir, './actors')
      }
    });

    this.broker.createService(SparqlEndpointService, {
      settings: {
        podProvider: true,
        defaultAccept: 'application/ld+json'
      }
    });

    this.broker.createService(TripleStoreService, {
      settings: {
        url: triplestore.url,
        user: triplestore.user,
        password: triplestore.password
      }
    });

    this.broker.createService(WebAclService, {
      settings: {
        baseUrl,
        podProvider: true
      }
    });

    this.broker.createService(WebfingerService, {
      settings: {
        baseUrl
      }
    });

    this.broker.createService(WebIdService, {
      settings: {
        baseUrl,
        podProvider: true
      },
      hooks: {
        before: {
          async create(ctx) {
            const { nick } = ctx.params;
            await ctx.call('pod.create', { username: nick });
          }
        }
      }
    });

    this.broker.createService(SynchronizerService, {
      settings: {
        podProvider: true,
        mirrorGraph: false,
        synchronizeContainers: false,
        attachToLocalContainers: true
      }
    });
  }
};

module.exports = CoreService;
