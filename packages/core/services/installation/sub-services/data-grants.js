const urlJoin = require('url-join');
const { ControlledContainerMixin, isURL, getSlugFromUri, arrayOf } = require('@semapps/ldp');

module.exports = {
  name: 'data-grants',
  mixins: [ControlledContainerMixin],
  settings: {
    acceptedTypes: ['interop:DataGrant'],
    newResourcesPermissions: {
      anon: {
        read: true
      }
    },
    excludeFromMirror: true
  },
  dependencies: ['ldp', 'ldp.registry', 'pod'],
  async started() {
    const baseUrl = await this.broker.call('ldp.getBaseUrl');
    for (let dataset of await this.broker.call('pod.list')) {
      const webId = urlJoin(baseUrl, dataset);
      this.logger.info(`Registering containers for ${webId}...`);
      const results = await this.actions.list({ webId });
      for (const dataGrant of arrayOf(results['ldp:contains'])) {
        await this.broker.call('ldp.registry.register', {
          path: dataGrant['apods:registeredContainer'].replace(urlJoin(webId, 'data'), ''),
          acceptedTypes: dataGrant['apods:registeredClass'],
          dataset
        });
      }
    }
  },
  actions: {
    async getForApp(ctx) {
      const { appUri, podOwner } = ctx.params;

      const containerUri = await this.actions.getContainerUri({ webId: podOwner }, { parentCtx: ctx });

      let filteredContainer = await this.actions.list(
        {
          containerUri,
          filters: {
            'http://www.w3.org/ns/solid/interop#dataOwner': podOwner,
            'http://www.w3.org/ns/solid/interop#grantee': appUri
          },
          webId: 'system'
        },
        { parentCtx: ctx }
      );

      return arrayOf(filteredContainer['ldp:contains']);
    }
  },
  hooks: {
    before: {
      async post(ctx) {
        const { resource } = ctx.params;

        const webId = resource['interop:dataOwner'];
        const dataset = getSlugFromUri(webId);
        const appUri = resource['interop:grantee'];
        const resourceType = resource['apods:registeredClass'];
        const accessMode = arrayOf(resource['interop:accessMode']);

        // Match a string of type ldp:Container
        const regex = /^([^:]+):([^:]+)$/gm;

        let ontology;
        if (isURL(resourceType)) {
          ontology = await ctx.call('ontologies.get', { uri: resourceType });
        } else if (resourceType.match(regex)) {
          const matchResults = regex.exec(resourceType);
          ontology = await ctx.call('ontologies.get', { prefix: matchResults[1] });
        } else {
          throw new Error(`Registered class must be an URI or prefixed. Received ${resourceType}`);
        }

        if (!ontology) {
          const prefix = await ctx.call('ontologies.findPrefix', { uri: resourceType });

          if (prefix) {
            const namespace = await ctx.call('ontologies.findNamespace', { prefix });

            await ctx.call('ontologies.register', { prefix, namespace });

            ontology = { prefix, namespace };
          }
        }

        if (!ontology) throw new Error(`Could not register ontology for resource type ${resourceType}`);

        // Check if a container registration already exist for this type (happens if another app registered the same type)
        let containerRegistration = await this.broker.call('ldp.registry.getByType', {
          type: resourceType,
          dataset
        });

        if (!containerRegistration) {
          // If the resource type is invalid, an error will be thrown here
          containerRegistration = await this.broker.call('ldp.registry.register', {
            acceptedTypes: resourceType,
            dataset
          });
        }

        const containerUri = await this.broker.call('ldp.registry.getUri', { path: containerRegistration.path, webId });

        // Give read-write permission to the application
        // For details, see https://github.com/assemblee-virtuelle/activitypods/issues/116
        await ctx.call('webacl.resource.addRights', {
          resourceUri: containerUri,
          additionalRights: {
            // Container rights
            user: {
              uri: appUri,
              read: accessMode.includes('acl:Read'),
              write: accessMode.includes('acl:Write')
            },
            // Resources default rights
            default: {
              user: {
                uri: appUri,
                read: accessMode.includes('acl:Read'),
                append: accessMode.includes('acl:Append'),
                write: accessMode.includes('acl:Write'),
                control: accessMode.includes('acl:Control')
              }
            }
          },
          webId: 'system'
        });

        ctx.params.resource['apods:registeredContainer'] = containerUri;
      }
    },
    after: {
      async delete(ctx, res) {
        const containerUri = res.oldData['apods:registeredContainer'];
        const appUri = res.oldData['interop:grantee'];

        // If we remove a right which hasn't been granted, no error will be thrown
        await ctx.call('webacl.resource.removeRights', {
          resourceUri: containerUri,
          rights: {
            user: {
              uri: appUri,
              read: true,
              write: true
            },
            default: {
              user: {
                uri: appUri,
                read: true,
                append: true,
                write: true,
                control: true
              }
            }
          },
          webId: 'system'
        });

        return res;
      }
    }
  }
};
