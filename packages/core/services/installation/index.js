const urlJoin = require('url-join');
const { ActivitiesHandlerMixin, ACTIVITY_TYPES } = require('@semapps/activitypub');
const { arrayOf } = require('@semapps/ldp');
const { MIME_TYPES } = require('@semapps/mime-types');
const { ClassDescriptionService } = require('@activitypods/description');
const interopContext = require('../../config/context-interop.json');
const AppRegistrationsService = require('./sub-services/app-registrations');
const AccessGrantsService = require('./sub-services/access-grants');
const DataGrantsService = require('./sub-services/data-grants');

module.exports = {
  name: 'installation',
  mixins: [ActivitiesHandlerMixin],
  created() {
    this.broker.createService(AppRegistrationsService);
    this.broker.createService(AccessGrantsService);
    this.broker.createService(DataGrantsService);
    this.broker.createService(ClassDescriptionService);
  },
  activities: {
    install: {
      match: {
        type: 'apods:Install'
      },
      async onEmit(ctx, activity, emitterUri) {
        const appUri = activity.object;
        let accessGrantsUris = [],
          preferredForClass = [];

        const app = await ctx.call('ldp.remote.get', { resourceUri: appUri });

        for (const accessNeedGroupUri of arrayOf(app['interop:hasAccessNeedGroup'])) {
          const accessNeedGroup = await ctx.call('ldp.remote.get', { resourceUri: accessNeedGroupUri });
          let dataGrantsUris = [];
          let specialRightsUris = [];

          if (activity['apods:acceptedAccessNeeds']) {
            for (const accessNeedUri of arrayOf(accessNeedGroup['interop:hasAccessNeed'])) {
              if (activity['apods:acceptedAccessNeeds'].includes(accessNeedUri)) {
                const accessNeed = await ctx.call('ldp.remote.get', { resourceUri: accessNeedUri });
                dataGrantsUris.push(
                  await ctx.call('data-grants.post', {
                    resource: {
                      type: 'interop:DataGrant',
                      'interop:dataOwner': emitterUri,
                      'interop:grantee': appUri,
                      'apods:registeredClass': accessNeed['apods:registeredClass'],
                      'interop:accessMode': accessNeed['interop:accessMode'],
                      'interop:scopeOfGrant': 'interop:All',
                      'interop:satisfiesAccessNeed': accessNeedUri
                    },
                    contentType: MIME_TYPES.JSON
                  })
                );
              }
            }
          }

          if (activity['apods:acceptedSpecialRights']) {
            for (const specialRightUri of arrayOf(accessNeedGroup['apods:hasSpecialRights'])) {
              if (activity['apods:acceptedSpecialRights'].includes(specialRightUri)) {
                specialRightsUris.push(specialRightUri);
              }
            }
          }

          // Only created the corresponding AccessGrant if a right was granted
          if (dataGrantsUris.length > 0 || specialRightsUris.length > 0) {
            accessGrantsUris.push(
              await ctx.call('access-grants.post', {
                resource: {
                  type: 'interop:AccessGrant',
                  'interop:grantedBy': emitterUri,
                  'interop:grantedAt': new Date().toISOString(),
                  'interop:grantee': appUri,
                  'interop:hasAccessNeedGroup': accessNeedGroupUri,
                  'interop:hasDataGrant': dataGrantsUris,
                  'apods:hasSpecialRights': specialRightsUris
                },
                contentType: MIME_TYPES.JSON
              })
            );
          }
        }

        if (app['interop:hasAccessDescriptionSet']) {
          const userData = await ctx.call('ldp.resource.get', {
            resourceUri: emitterUri,
            accept: MIME_TYPES.JSON,
            webId: emitterUri
          });

          const userLocale = userData['schema:knowsLanguage'];

          let classDescriptionsUris, defaultClassDescriptionsUris;

          for (const setUri of arrayOf(app['interop:hasAccessDescriptionSet'])) {
            const set = await ctx.call('ldp.remote.get', { resourceUri: setUri, webId: emitterUri });
            if (set['interop:usesLanguage'] === userLocale) {
              classDescriptionsUris = arrayOf(set['apods:hasClassDescription']);
            } else if (set['interop:usesLanguage'] === 'en') {
              defaultClassDescriptionsUris = arrayOf(set['apods:hasClassDescription']);
            }
          }

          if (!classDescriptionsUris) classDescriptionsUris = defaultClassDescriptionsUris;

          for (const classDescriptionUri of classDescriptionsUris) {
            const classDescription = await ctx.call('ldp.remote.get', {
              resourceUri: classDescriptionUri,
              webId: emitterUri
            });
            await ctx.call('ldp.remote.store', { resource: classDescription, webId: emitterUri });
            await ctx.call('class-description.attach', { resourceUri: classDescriptionUri });

            const preferredAppForClass = await ctx.call('app-registrations.preferredAppForClass', {
              type: classDescription['apods:describedClass']
            });

            console.log('preferredAppForClass', classDescription['apods:describedClass'], preferredAppForClass);

            if (!preferredAppForClass) {
              preferredForClass.push(classDescription['apods:describedClass']);
            }
          }
        }

        console.log('preferredForClass', preferredForClass);

        const appRegistrationUri = await ctx.call('app-registrations.post', {
          resource: {
            type: 'interop:ApplicationRegistration',
            'interop:registeredBy': emitterUri,
            'interop:registeredAt': new Date().toISOString(),
            'interop:updatedAt': new Date().toISOString(),
            'interop:registeredAgent': appUri,
            'interop:hasAccessGrant': accessGrantsUris,
            'apods:preferredForClass': preferredForClass
          },
          contentType: MIME_TYPES.JSON
        });

        await ctx.call('activitypub.outbox.post', {
          collectionUri: urlJoin(emitterUri, 'outbox'),
          '@context': ['https://www.w3.org/ns/activitystreams', interopContext],
          '@type': 'Create',
          object: appRegistrationUri,
          to: appUri
        });
      }
    },
    rejectAppRegistration: {
      match: {
        type: ACTIVITY_TYPES.REJECT,
        object: {
          type: ACTIVITY_TYPES.CREATE,
          object: {
            type: 'interop:ApplicationRegistration'
          }
        }
      },
      async onReceive(ctx, activity, recipientUri) {
        const appRegistrationUri = activity.object.object.id;

        const appRegistration = await ctx.call('app-registrations.get', {
          resourceUri: appRegistrationUri,
          webId: recipientUri
        });

        // SECURITY CHECKS

        if (appRegistration['interop:registeredBy'] !== recipientUri) {
          throw new Error(`The ApplicationRegistration ${appRegistrationUri} is not owned by ${recipientUri}`);
        }

        if (appRegistration['interop:registeredAgent'] !== activity.actor) {
          throw new Error(`The ApplicationRegistration ${appRegistrationUri} is not for actor ${activity.actor}`);
        }

        // DELETE APPLICATION REGISTRATION (THIS WILL ALSO DELETE ALL ASSOCIATED GRANTS)

        await ctx.call('app-registrations.delete', {
          resourceUri: appRegistrationUri,
          webId: recipientUri
        });
      }
    },
    uninstall: {
      match: {
        type: ACTIVITY_TYPES.UNDO,
        object: {
          type: 'apods:Install'
        }
      },
      async onEmit(ctx, activity, emitterUri) {
        const appUri = activity.object.object;

        const appRegistration = await ctx.call('app-registrations.getForApp', { appUri });

        if (appRegistration) {
          // Delete registration locally (through activitypub.object.process) and warn the app to delete its cache
          await ctx.call('activitypub.outbox.post', {
            collectionUri: urlJoin(emitterUri, 'outbox'),
            type: ACTIVITY_TYPES.DELETE,
            object: appRegistration.id || appRegistration['@id'],
            to: appUri
          });
        }
      }
    }
  }
};
