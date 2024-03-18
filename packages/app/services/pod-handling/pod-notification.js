const Handlebars = require('handlebars');
const urlJoin = require('url-join');
const { OBJECT_TYPES } = require('@semapps/activitypub');
const { isObject } = require('@semapps/ldp');

module.exports = {
  name: 'pod-notifications',
  settings: {
    frontUrl: null,
    handlebars: {
      helpers: {
        encodeUri: uri => encodeURIComponent(uri)
      }
    }
  },
  async started() {
    for (const [name, fn] of Object.entries(this.settings.handlebars.helpers)) {
      this.logger.info(`Registering handlebars helper ${name}`);
      Handlebars.registerHelper(name, fn);
    }
  },
  actions: {
    async send(ctx) {
      const { template, recipientUri, activity, context, ...rest } = ctx.params;

      const app = await ctx.call('app.get');
      const recipient = await ctx.call('activitypub.actor.get', { actorUri: recipientUri });
      const locale = recipient['schema:knowsLanguage'] || 'en';

      let templateParams = {};

      if (activity) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: activity.actor });
        let emitterProfile = {};
        try {
          emitterProfile = emitter.url
            ? await ctx.call('pod-resources.get', { resourceUri: emitter.url, actorUri: recipientUri })
            : {};
        } catch (e) {
          this.logger.warn(`Could not get profile of actor ${activity.actor}`);
        }
        templateParams = { activity, emitter, emitterProfile, ...rest };
      } else {
        templateParams = { ...rest };
      }

      const values = this.parseTemplate(template, templateParams, locale);

      await ctx.call('activitypub.outbox.post', {
        collectionUri: app.outbox,
        type: [OBJECT_TYPES.NOTE, 'apods:Notification'],
        actor: app.id,
        name: values.title,
        content: values.content,
        url: values.actions?.map(action => ({
          type: 'Link',
          name: action.caption,
          href: action.link.startsWith('http') ? action.link : urlJoin(this.settings.frontUrl, action.link)
        })),
        to: recipientUri,
        context
      });
    }
  },
  methods: {
    parseTemplate(template, params, locale) {
      return (
        template &&
        Object.fromEntries(
          Object.entries(template).map(([key, value]) => {
            if (typeof value === 'string') {
              const compiledValue = Handlebars.compile(value);
              return [key, compiledValue(params)];
            } else if (isObject(value)) {
              // If we have an object with locales mapping, look for the right locale
              if (value[locale]) {
                const compiledValue = Handlebars.compile(value[locale]);
                return [key, compiledValue(params)];
              } else {
                throw new Error(`No ${locale} locale found for key ${key}`);
              }
            } else if (Array.isArray(value)) {
              return [key, value.map(v => this.parseTemplate(v, params, locale))];
            }
          })
        )
      );
    }
  }
};
