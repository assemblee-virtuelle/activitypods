const path = require('path');
const urlJoin = require('url-join');
const { ActivityPubService, ActivityMappingService, ProxyService } = require('@semapps/activitypub');
const { AuthLocalService, AuthOIDCService } = require('@semapps/auth');
const FusekiAdminService = require('@semapps/fuseki-admin');
const { JsonLdService } = require('@semapps/jsonld');
const { LdpService, DocumentTaggerMixin } = require('@semapps/ldp');
const { PodService } = require('@semapps/pod');
const { SignatureService } = require('@semapps/signature');
const { SparqlEndpointService } = require('@semapps/sparql-endpoint');
const { TripleStoreService } = require('@semapps/triplestore');
const { WebAclService } = require('@semapps/webacl');
const { WebfingerService } = require('@semapps/webfinger');
const { WebIdService } = require('@semapps/webid');
const { SynchronizerService } = require('@activitypods/synchronizer');
const { AnnouncerService } = require('@activitypods/announcer');
const ApiService = require('./services/api');
const MigrationService = require('./services/migration');
const containers = require('./config/containers');
const ontologies = require('./config/ontologies.json');

const CoreService = {
  name: 'core',
  settings: {
    baseUrl: null,
    baseDir: null,
    fuseki: {
      url: null,
      user: null,
      password: null,
    },
    jsonContext: null,
    queueServiceUrl: null,
    authType: 'local'
  },
  created() {
    let { baseUrl, baseDir, fuseki, jsonContext, queueServiceUrl, authType } = this.settings;

    // If an external JSON context is not provided, we will use a local one
    const localJsonContext = urlJoin(baseUrl, '_system', 'context.json');

    this.broker.createService(ActivityPubService, {
      settings: {
        baseUri: baseUrl,
        jsonContext: jsonContext || localJsonContext,
        containers,
        podProvider: true,
        dispatch: {
          queueServiceUrl,
        },
      },
    });

    this.broker.createService(ApiService, {
      settings: {
        ...this.settings.api
      }
    });

    this.broker.createService(authType === 'local' ? AuthLocalService : AuthOIDCService, {
      settings: {
        baseUrl,
        jwtPath: path.resolve(baseDir, './jwt'),
        reservedUsernames: ['sparql', 'auth', 'common', 'data', 'settings', 'localData', 'testData'],
        webIdSelection: ['nick'],
        accountSelection: ['preferredLocale', 'preferredFrontUrl', 'preferredFrontName'],
        ...this.settings.auth,
      },
    });

    this.broker.createService(FusekiAdminService, {
      settings: {
        url: fuseki.url,
        user: fuseki.user,
        password: fuseki.password,
      },
    });

    this.broker.createService(JsonLdService, {
      settings: {
        baseUri: baseUrl,
        localContextFiles: jsonContext
          ? undefined
          : [
              {
                path: '_system/context.json',
                file: path.resolve(__dirname, './config/context.json'),
              },
            ],
        remoteContextFiles: [
          {
            uri: 'https://www.w3.org/ns/activitystreams',
            file: path.resolve(__dirname, './config/context-as.json'),
          },
        ],
      },
    });

    this.broker.createService(LdpService, {
      mixins: [DocumentTaggerMixin],
      settings: {
        baseUrl,
        ontologies,
        podProvider: true,
        containers,
        defaultContainerOptions: {
          jsonContext: jsonContext || localJsonContext,
          permissions: {},
          newResourcesPermissions: {},
        },
      },
    });

    this.broker.createService(PodService, {
      settings: {
        baseUrl,
      },
    });

    // Required for notifications
    this.broker.createService(ActivityMappingService, {
      settings: {
        handlebars: {
          helpers: {
            encodeUri: (uri) => encodeURIComponent(uri),
          },
        },
      },
    });

    this.broker.createService(ProxyService, {
      settings: {
        podProvider: true,
      },
    });

    this.broker.createService(SignatureService, {
      settings: {
        actorsKeyPairsDir: path.resolve(baseDir, './actors'),
      },
    });

    this.broker.createService(SparqlEndpointService, {
      settings: {
        podProvider: true,
        defaultAccept: 'application/ld+json',
      },
    });

    this.broker.createService(TripleStoreService, {
      settings: {
        sparqlEndpoint: fuseki.url,
        jenaUser: fuseki.user,
        jenaPassword: fuseki.password,
      },
    });

    this.broker.createService(WebAclService, {
      settings: {
        baseUrl,
        podProvider: true,
      },
    });

    this.broker.createService(WebfingerService, {
      settings: {
        baseUrl,
      },
    });

    this.broker.createService(WebIdService, {
      settings: {
        baseUrl,
        podProvider: true,
      },
      hooks: {
        before: {
          async create(ctx) {
            const { nick } = ctx.params;
            await ctx.call('pod.create', { username: nick });
          },
        },
      },
    });

    this.broker.createService(SynchronizerService);
    this.broker.createService(AnnouncerService);

    this.broker.createService(MigrationService, {
      settings: {
        baseUrl,
      },
    });
  },
};

module.exports = CoreService;
