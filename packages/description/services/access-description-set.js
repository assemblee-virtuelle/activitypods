const { ControlledContainerMixin } = require('@semapps/ldp');
const { triple, namedNode } = require('@rdfjs/data-model');
const { MIME_TYPES } = require('@semapps/mime-types');

module.exports = {
  name: 'access-description-set',
  mixins: [ControlledContainerMixin],
  settings: {
    acceptedTypes: ['interop:AccessDescriptionSet'],
    readOnly: true,
    excludeFromMirror: true
  },
  actions: {
    async attachClassDescription(ctx) {
      const { locale, classDescriptionUri } = ctx.params;
      const descriptionSet = await this.actions.findByLocale({ locale }, { parentCtx: ctx });

      if (descriptionSet) {
        await ctx.call('access-description-set.patch', {
          resourceUri: descriptionSet.id,
          triplesToAdd: [
            triple(
              namedNode(descriptionSet.id),
              namedNode('http://activitypods.org/ns/core#hasClassDescription'),
              namedNode(classDescriptionUri)
            )
          ],
          webId: 'system'
        });
        return descriptionSet.id;
      } else {
        const accessDescriptionSetUri = await ctx.call('access-description-set.post', {
          resource: {
            type: 'interop:AccessDescriptionSet',
            'interop:usesLanguage': locale,
            'apods:hasClassDescription': classDescriptionUri
          },
          contentType: MIME_TYPES.JSON,
          webId: 'system'
        });
        return accessDescriptionSetUri;
      }
    },
    async findByLocale(ctx) {
      const { locale, webId } = ctx.params;
      const descriptionSets = await this.actions.list({ webId }, { parentCtx: ctx });
      return descriptionSets['ldp:contains']?.find(set => set['interop:usesLanguage'] === locale);
    }
  }
};
