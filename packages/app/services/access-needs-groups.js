const { ControlledContainerMixin } = require('@semapps/ldp');
const { MIME_TYPES } = require('@semapps/mime-types');
const { interopContext } = require('@activitypods/core');

module.exports = {
  name: 'access-needs-groups',
  mixins: [ControlledContainerMixin],
  settings: {
    accessNeeds: {
      required: [],
      optional: []
    },
    // ControlledContainerMixin settings
    path: '/access-needs-groups',
    acceptedTypes: ['interop:AccessNeedGroup'],
    readOnly: true
  },
  dependencies: ['actors'],
  actions: {
    async initialize(ctx) {
      for (const [necessity, accessNeeds] of Object.entries(this.settings.accessNeeds)) {
        let accessNeedsUris = [],
          specialRights = [];

        if (accessNeeds.length > 0) {
          for (const accessNeed of accessNeeds) {
            if (typeof accessNeed === 'string') {
              // If a string is provided, we have a special access need (e.g. apods:ReadInbox)
              specialRights.push(accessNeed);
            } else {
              accessNeedsUris.push(
                await ctx.call('access-needs.post', {
                  resource: {
                    '@context': interopContext,
                    '@type': 'interop:AccessNeed',
                    'interop:accessNecessity':
                      necessity === 'required' ? 'interop:AccessRequired' : 'interop:AccessOptional',
                    'interop:accessMode': accessNeed.accessMode,
                    'apods:registeredClass': accessNeed.registeredClass
                  },
                  contentType: MIME_TYPES.JSON,
                  webId: 'system'
                })
              );
            }
          }

          const accessNeedGroupUri = await this.actions.post(
            {
              resource: {
                '@context': interopContext,
                '@type': 'interop:AccessNeedGroup',
                'interop:accessNecessity':
                  necessity === 'required' ? 'interop:AccessRequired' : 'interop:AccessOptional',
                'interop:accessScenario': 'interop:PersonalAccess',
                'interop:authenticatedAs': 'interop:SocialAgent',
                'interop:hasAccessNeed': accessNeedsUris,
                'apods:hasSpecialRights': specialRights
              },
              contentType: MIME_TYPES.JSON,
              webId: 'system'
            },
            {
              parentCtx: ctx
            }
          );

          await ctx.call('actors.attachAccessNeedGroup', { accessNeedGroupUri });
        }
      }
    }
  }
};