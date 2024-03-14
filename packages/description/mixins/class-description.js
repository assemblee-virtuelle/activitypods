// To be used with ControlledContainerMixin

const { MIME_TYPES } = require('@semapps/mime-types');

module.exports = {
  settings: {
    classDescription: {
      label: {},
      labelPredicate: undefined,
      openEndpoint: undefined
    }
  },
  dependencies: ['class-description'],
  async started() {
    if (!this.settings.acceptedTypes) {
      throw new Error(
        `The ClassDescriptionMixin must be used with the ControlledContainerMixin. No acceptedTypes setting defined.`
      );
    }
  },
  actions: {
    async registerClassDescription(ctx) {
      const { webId } = ctx.params;

      const userData = await ctx.call('ldp.resource.get', {
        resourceUri: webId,
        accept: MIME_TYPES.JSON,
        webId
      });

      const userLocale = userData['schema:knowsLanguage'];

      if (userLocale) {
        // Register only the ClassDescription with the user locale
        const label = this.settings.classDescription.label[userLocale]
          ? {
              [userLocale]: this.settings.classDescription.label[userLocale]
            }
          : { en: this.settings.classDescription.label.en };

        await ctx.call('class-description.register', {
          type: Array.isArray(this.settings.acceptedTypes)
            ? this.settings.acceptedTypes[0]
            : this.settings.acceptedTypes,
          label,
          labelPredicate: this.settings.classDescription.labelPredicate,
          openEndpoint: this.settings.classDescription.openEndpoint,
          podOwner: webId
        });
      } else {
        this.logger.warn(`No local found for user ${webId}`);
      }
    },
    async registerClassDescriptionForAll(ctx) {
      for (let dataset of await ctx.call('pod.list')) {
        const [account] = await ctx.call('auth.account.find', { query: { username: dataset } });
        this.logger.info(`Registering ClassDescription for user ${account.webId}...`);
        await this.actions.registerClassDescription({ webId: account.webId }, { parentCtx: ctx });
      }
    }
  },
  events: {
    async 'auth.registered'(ctx) {
      const { webId } = ctx.params;

      await ctx.call('ldp.resource.awaitCreateComplete', {
        resourceUri: webId,
        predicates: ['schema:knowsLanguage']
      });

      await this.actions.registerClassDescription({ webId }, { parentCtx: ctx });
    }
  }
};
