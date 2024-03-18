const { ControlledContainerMixin } = require('@semapps/ldp');

module.exports = {
  name: 'data-grants',
  mixins: [ControlledContainerMixin],
  settings: {
    acceptedTypes: ['interop:DataGrant'],
    newResourcesPermissions: {}
  },
  actions: {
    async getContainerByType(ctx) {
      const { type, podOwner } = ctx.params;

      const app = await ctx.call('app.get');
      const containerUri = await this.actions.getContainerUri({ webId: podOwner }, { parentCtx: ctx });
      const fullTypeUri = await ctx.call('jsonld.parser.expandTypes', { types: [type] });

      const filteredContainer = await this.actions.list(
        {
          containerUri,
          filters: {
            'http://www.w3.org/ns/solid/interop#registeredClass': fullTypeUri,
            'http://www.w3.org/ns/solid/interop#grantedBy': podOwner,
            'http://www.w3.org/ns/solid/interop#grantee': app.id
          },
          webId: 'system'
        },
        { parentCtx: ctx }
      );

      return filteredContainer['ldp:contains']?.[0]?.['interop:registeredContainer'];
    }
  }
};
