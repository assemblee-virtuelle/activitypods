const { triple, namedNode, literal } = require('@rdfjs/data-model');

module.exports = {
  name: 'migration',
  actions: {
    async migratePreferredLocale(ctx) {
      for (let dataset of await ctx.call('pod.list')) {
        const [account] = await ctx.call('auth.account.find', { query: { username: dataset } });
        if (account.preferredLocale) {
          this.logger.info(`Migrating preferred locale for ${account.webId}`);
          await ctx.call('ldp.resource.patch', {
            resourceUri: account.webId,
            triplesToAdd: [
              triple(
                namedNode(account.webId),
                namedNode('http://schema.org/knowsLanguage'),
                literal(account.preferredLocale)
              )
            ],
            webId: 'system'
          });

          await ctx.call('auth.account.update', {
            id: account['@id'],
            preferredLocale: undefined
          });
        } else {
          this.logger.warn(`No preferred locale found for ${account.webId}`);
        }
      }
    }
  }
};
