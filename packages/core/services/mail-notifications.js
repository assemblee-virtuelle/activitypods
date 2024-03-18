const path = require('path');
const urlJoin = require('url-join');
const Handlebars = require('handlebars');
const MailService = require('moleculer-mail');
const { ActivitiesHandlerMixin } = require('@semapps/activitypub');
const { arrayOf, isObject } = require('@semapps/ldp');

module.exports = {
  name: 'mail-notifications',
  mixins: [MailService, ActivitiesHandlerMixin],
  settings: {
    frontendUrl: null,
    handlebars: {
      helpers: {
        encodeUri: uri => encodeURIComponent(uri)
      }
    },
    // See moleculer-mail doc https://github.com/moleculerjs/moleculer-addons/tree/master/packages/moleculer-mail
    templateFolder: path.join(__dirname, '../templates'),
    from: null,
    transport: null,
    data: {
      color: '#E2003B'
    }
  },
  async started() {
    for (const [name, fn] of Object.entries(this.settings.handlebars.helpers)) {
      this.logger.info(`Registering handlebars helper ${name}`);
      Handlebars.registerHelper(name, fn);
    }
  },
  actions: {
    // Allow local service to send directly notifications without sending a apods:Notification activity
    async notify(ctx) {
      const { template, recipientUri, activity, context, ...rest } = ctx.params;

      const account = await ctx.call('auth.account.findByWebId', { webId: recipientUri });
      const recipient = await ctx.call('activitypub.actor.get', { actorUri: recipientUri });
      const locale = recipient['schema:knowsLanguage'] || 'en';

      const emitter = await ctx.call('activitypub.actor.get', { actorUri: activity.actor, webId: recipientUri });

      let emitterProfile = {};
      try {
        emitterProfile = emitter.url
          ? await ctx.call('activitypub.actor.getProfile', { actorUri: activity.actor, webId: recipientUri })
          : {};
      } catch (e) {
        this.logger.warn(`Could not get profile of actor ${activity.actor}`);
      }

      const templateParams = { activity, emitter, emitterProfile, ...rest };

      const values = this.parseTemplate(template, templateParams, locale);

      await this.queueMail(ctx, values.title, {
        to: account.email,
        data: {
          title: values.title,
          content: values.content,
          contentWithBr: values.content ? values.content.replace(/\r\n|\r|\n/g, '<br />') : undefined,
          actions: arrayOf(values.actions).map(action => ({
            caption: action.caption,
            link: action.link.startsWith('http') ? action.link : urlJoin(this.settings.frontendUrl, action.link)
          }))
        }
      });
    }
  },
  activities: {
    appNotification: {
      match: {
        type: 'apods:Notification'
      },
      async onReceive(ctx, activity, recipientUri) {
        if (!(await ctx.call('app-registrations.isRegistered', { appUri: activity.actor, podOwner: recipientUri }))) {
          this.logger.warn(`Application ${activity.actor} is not registered by ${recipientUri}`);
          return;
        }

        const account = await ctx.call('auth.account.findByWebId', { webId: recipientUri });

        await this.queueMail(ctx, activity.name, {
          to: account.email,
          data: {
            title: activity.name,
            content: activity.content,
            contentWithBr: activity.content ? activity.content.replace(/\r\n|\r|\n/g, '<br />') : undefined,
            actions: arrayOf(activity.url).map(url => ({ caption: url.name, link: url.href }))
          }
        });
      }
    }
  },
  methods: {
    async queueMail(ctx, title, payload) {
      payload.template = 'single-mail';
      if (this.createJob) {
        return this.createJob('sendMail', title, payload);
      }
      await this.actions.send(payload, { parentCtx: ctx });
    },
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
  },
  queues: {
    sendMail: {
      name: '*',
      async process(job) {
        job.progress(0);
        const result = await this.actions.send(job.data);
        job.progress(100);
        return result;
      }
    }
  }
};
