const FetchPodOrProxyMixin = require('../../mixins/fetch-pod-or-proxy');
const SparqlGenerator = require('sparqljs').Generator;

module.exports = {
  name: 'pod-resources',
  mixins: [FetchPodOrProxyMixin],
  started() {
    this.sparqlGenerator = new SparqlGenerator({
      /* prefixes, baseIRI, factory, sparqlStar */
    });
  },
  actions: {
    async post(ctx) {
      const { containerUri, resource, actorUri } = ctx.params;

      // Adds the default context, if it is missing
      if (!resource['@context']) {
        resource = {
          '@context': await ctx.call('jsonld.context.get'),
          ...resource
        };
      }

      const { headers } = await this.actions.fetch({
        url: containerUri,
        method: 'POST',
        headers: {
          'Content-Type': 'application/ld+json'
        },
        body: JSON.stringify(resource),
        actorUri
      });

      return headers.get('Location');
    },
    async list(ctx) {
      const { containerUri, actorUri } = ctx.params;

      const { body } = await this.actions.fetch({
        url: containerUri,
        method: 'GET',
        headers: {
          Accept: 'application/ld+json',
          JsonLdContext: JSON.stringify(await ctx.call('jsonld.context.get'))
        },
        actorUri
      });

      return body;
    },
    async get(ctx) {
      const { resourceUri, actorUri } = ctx.params;

      const { body } = await this.actions.fetch({
        url: resourceUri,
        method: 'GET',
        headers: {
          Accept: 'application/ld+json',
          JsonLdContext: JSON.stringify(await ctx.call('jsonld.context.get'))
        },
        actorUri
      });

      return body;
    },
    async patch(ctx) {
      const { resourceUri, triplesToAdd, triplesToRemove, actorUri } = ctx.params;

      let sparqlUpdate = {
        type: 'update',
        updates: []
      };

      if (triplesToAdd) {
        sparqlUpdate.updates.push({
          updateType: 'insert',
          insert: [{ type: 'bgp', triples: triplesToAdd }]
        });
      }

      if (triplesToRemove) {
        sparqlUpdate.updates.push({
          updateType: 'delete',
          delete: [{ type: 'bgp', triples: triplesToRemove }]
        });
      }

      await this.actions.fetch({
        url: resourceUri,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: this.sparqlGenerator.stringify(sparqlUpdate),
        actorUri
      });
    },
    async put(ctx) {
      let { resource, actorUri } = ctx.params;

      // Adds the default context, if it is missing
      if (!resource['@context']) {
        resource = {
          '@context': await ctx.call('jsonld.context.get'),
          ...resource
        };
      }

      await this.actions.fetch({
        url: resource.id || resource['@id'],
        method: 'PUT',
        headers: {
          'Content-Type': 'application/ld+json'
        },
        body: JSON.stringify(resource),
        actorUri
      });
    },
    async delete(ctx) {
      const { resourceUri, actorUri } = ctx.params;

      await this.actions.fetch({
        url: resourceUri,
        method: 'DELETE',
        actorUri
      });
    }
  }
};
