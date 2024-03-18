const urlJoin = require('url-join');
const createSlug = require('speakingurl');
const { Errors: E } = require('moleculer-web');
const { arrayOf, hasType, getParentContainerUri } = require('@semapps/ldp');
const { ACTIVITY_TYPES, ACTOR_TYPES } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');

const DEFAULT_ALLOWED_TYPES = [...Object.values(ACTOR_TYPES), ...Object.values(ACTIVITY_TYPES)];

// TODO use cache to improve performances
const getAllowedTypes = async (ctx, appUri, podOwner, accessMode) => {
  const dataGrants = await ctx.call('data-grants.getForApp', { appUri, podOwner });

  let types = [...DEFAULT_ALLOWED_TYPES];
  for (const dataGrant of dataGrants) {
    if (arrayOf(dataGrant['interop:accessMode']).includes(accessMode)) {
      types.push(...arrayOf(dataGrant['apods:registeredClass']));
    }
  }

  return await ctx.call('jsonld.parser.expandTypes', { types });
};

const AppControlMiddleware = ({ baseUrl }) => ({
  name: 'AppControlMiddleware',
  async started() {
    if (!baseUrl) throw new Error('The baseUrl config is missing for the AppControlMiddleware');
  },
  localAction: (next, action) => {
    if (action.name === 'signature.proxy.api_query') {
      return async ctx => {
        const podOwner = urlJoin(baseUrl, ctx.params.username);
        const url = ctx.params.id;

        // Bypass checks if user is querying his own pod
        if (ctx.meta.webId === podOwner) {
          return next(ctx);
        }

        const appUri = ctx.meta.webId;

        // Ensure we are fetching remote data (otherwise this could be a security issue)
        console.log('url startsWith', url);
        if (url.startsWith(podOwner)) {
          throw new E.ForbiddenError(`The proxy cannot be used to fetch local data`);
        }

        // Ensure the webId is a registered application
        if (!(await ctx.call('app-registrations.isRegistered', { appUri, podOwner }))) {
          throw new E.ForbiddenError(`Only registered applications may fetch the proxy endpoint`);
        }

        // Ensure the application has the right to modify this resource
        if (ctx.params.method === 'PUT' || ctx.params.method === 'DELETE') {
          let resourceTypes = [];
          try {
            // Fetch the resource to have its type
            const resource = await ctx.call('ldp.remote.get', { resourceUri: url, webId: podOwner });
            resourceTypes = await ctx.call('jsonld.parser.expandTypes', {
              types: resource.type || resource['@type'],
              context: resource['@context']
            });
          } catch (e) {
            // If we can't GET the resource, we won't authorize the call to the proxy
            throw new E.ForbiddenError(`No ${ctx.params.method} call is allowed on the URL ${url}`);
          }

          const allowedTypes = await getAllowedTypes(ctx, appUri, podOwner, 'acl:Write');

          if (!resourceTypes.some(t => allowedTypes.includes(t))) {
            throw new E.ForbiddenError(
              `The type of the resource being modified (${resourceTypes.join(', ')}) doesn't match any authorized types`
            );
          }
        }

        // Ensure the application has the right to create this resource
        if (ctx.params.method === 'POST') {
          const resource = await ctx.call('ldp.remote.getNetwork', { resourceUri: url, webId: podOwner });
          if (hasType(resource, 'ldp:Container')) {
            throw new E.ForbiddenError(`Cannot post to ${url} because it is not a container`);
          }

          const resourceTypes = await ctx.call('jsonld.parser.expandTypes', {
            types: ctx.params.body.type || ctx.params.body['@type'],
            context: ctx.params.body['@context']
          });

          const allowedTypes = await getAllowedTypes(ctx, appUri, podOwner, 'acl:Write');

          if (!resourceTypes.some(t => allowedTypes.includes(t))) {
            throw new E.ForbiddenError(`The type of the resource being posted doesn't match any authorized types`);
          }
        }

        // Impersonate the user so that signature.proxy.api_query can be called
        ctx.meta.webId = podOwner;

        const result = await next(ctx);

        ctx.meta.webId = appUri;

        // Check if the application has the right to read this type of data
        if (result && ctx.params.method === 'GET') {
          const allowedTypes = await getAllowedTypes(ctx, appUri, podOwner, 'acl:Read');

          const resourceTypes = await ctx.call('jsonld.parser.expandTypes', {
            types: result.type || result['@type'],
            context: result['@context']
          });

          if (!resourceTypes.some(t => allowedTypes.includes(t))) {
            throw new E.ForbiddenError(`The type of the resource being fetched doesn't match any authorized types`);
          }
        }

        return result;
      };
    } else if (action.name === 'activitypub.outbox.post') {
      return async ctx => {
        const { collectionUri, ...activity } = ctx.params;
        const podOwner = getParentContainerUri(collectionUri);

        // Bypass checks if user is posting to their outbox
        if (ctx.meta.webId === podOwner) {
          return next(ctx);
        }

        const appUri = ctx.meta.webId;

        // Ensure the webId is a registered application
        if (!(await ctx.call('app-registrations.isRegistered', { appUri, podOwner }))) {
          throw new E.ForbiddenError(`Only registered applications may post to the user outbox`);
        }

        const specialRights = await ctx.call('access-grants.getSpecialRights', { appUri, podOwner });
        if (!specialRights.includes('apods:PostOutbox')) {
          throw new E.ForbiddenError(`The application has no permission to post to the outbox (apods:PostOutbox)`);
        }

        if (hasType(activity, 'Create') || hasType(activity, 'Update') || hasType(activity, 'Delete')) {
          const allowedTypes = await getAllowedTypes(ctx, appUri, podOwner, 'acl:Write');
          let resourceTypes;

          if (hasType(activity, 'Create')) {
            resourceTypes = await ctx.call('jsonld.parser.expandTypes', {
              types: activity.object.type || activity.object['@type'],
              context: activity['@context']
            });
          } else {
            try {
              const resource = await ctx.call('ldp.resource.get', {
                resourceUri: activity.object.id || activity.object['@id'],
                accept: MIME_TYPES.JSON,
                webId: 'system'
              });

              resourceTypes = await ctx.call('jsonld.parser.expandTypes', {
                types: resource.type || resource['@type'],
                context: activity['@context']
              });
            } catch (e) {
              throw new E.ForbiddenError(`The resource ${activity.object.id || activity.object['@id']} doesn't exist`);
            }
          }

          if (!resourceTypes.some(t => allowedTypes.includes(t))) {
            throw new E.ForbiddenError(`The type of the resource doesn't match any authorized types`);
          }
        }

        // Impersonate the user so that signature.proxy.api_query can be called
        ctx.meta.webId = podOwner;

        ctx.params.generator = appUri;

        return await next(ctx);
      };
    } else if (action.name === 'webacl.group.api_create') {
      return async ctx => {
        const { username } = ctx.params;
        const podOwner = urlJoin(baseUrl, username);

        // Bypass checks if user is acting on their own
        if (ctx.meta.webId === podOwner) {
          return next(ctx);
        }

        const appUri = ctx.meta.webId;

        // Ensure the webId is a registered application
        if (!(await ctx.call('app-registrations.isRegistered', { appUri, podOwner }))) {
          throw new E.ForbiddenError(`Only registered applications may handle ACL groups`);
        }

        const specialRights = await ctx.call('access-grants.getSpecialRights', { appUri, podOwner });
        if (!specialRights.includes('apods:CreateAclGroup')) {
          throw new E.ForbiddenError(`The application has no permission to handle ACL groups (apods:CreateAclGroup)`);
        }

        return await next(ctx);
      };
    }

    // Do not use the middleware for this action
    return next;
  }
});

module.exports = AppControlMiddleware;
