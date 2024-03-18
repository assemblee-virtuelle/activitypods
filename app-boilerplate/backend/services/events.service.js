const { triple, namedNode, literal } = require('@rdfjs/data-model');
const { PodResourcesHandlerMixin } = require('@activitypods/app');

module.exports = {
  name: 'events',
  mixins: [PodResourcesHandlerMixin],
  settings: {
    type: 'Event'
  },
  methods: {
    async onCreate(ctx, resource, actorUri) {
      await this.actions.patch(
        {
          resourceUri: resource.id || resource['@id'],
          triplesToAdd: [
            triple(
              namedNode(resource.id || resource['@id']),
              namedNode('https://www.w3.org/ns/activitystreams#summary'),
              literal('A super-powerful AI-generated summary')
            )
          ],
          actorUri
        },
        { parentCtx: ctx }
      );
    }
  }
};
