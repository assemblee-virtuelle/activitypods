const { MoleculerError } = require('moleculer').Errors;
const { ActivitiesHandlerMixin, ACTIVITY_TYPES } = require('@semapps/activitypub');
const { arrayOf } = require('@semapps/ldp');
const { MIME_TYPES } = require('@semapps/mime-types');

module.exports = {
  name: 'app.registration',
  mixins: [ActivitiesHandlerMixin],
  activities: {
    createAppRegistration: {
      match: {
        type: ACTIVITY_TYPES.CREATE,
        object: {
          type: 'interop:ApplicationRegistration'
        }
      },
      async onReceive(ctx, activity, recipientUri) {
        const outboxUri = await ctx.call('activitypub.actor.getCollectionUri', {
          actorUri: recipientUri,
          predicate: 'outbox'
        });

        try {
          // ENSURE THE APP IS NOT ALREADY REGISTERED

          let filteredContainer = await ctx.call('app-registrations.list', {
            filters: {
              'http://www.w3.org/ns/solid/interop#registeredBy': activity.actor
            },
            accept: MIME_TYPES.JSON
          });

          if (filteredContainer['ldp:contains'].length > 0) {
            throw new MoleculerError(
              `User already has an application registration. Update or delete it.`,
              400,
              'BAD REQUEST'
            );
          }

          // GET APP REGISTRATION AND GRANTS

          // Use local context to get all data
          const jsonContext = await ctx.call('jsonld.context.get');

          const appRegistration = await ctx.call('ldp.remote.get', {
            resourceUri: activity.object.id,
            jsonContext
          });

          const accessGrants = await Promise.all(
            arrayOf(appRegistration['interop:hasAccessGrant']).map(accessGrantUri =>
              ctx.call('ldp.remote.get', {
                resourceUri: accessGrantUri,
                jsonContext,
                accept: MIME_TYPES.JSON
              })
            )
          );

          const dataGrantsUris = accessGrants.reduce(
            (acc, cur) => (cur['interop:hasDataGrant'] ? [...acc, ...arrayOf(cur['interop:hasDataGrant'])] : acc),
            []
          );
          const specialRightsUris = accessGrants.reduce(
            (acc, cur) => (cur['apods:hasSpecialRights'] ? [...acc, ...arrayOf(cur['apods:hasSpecialRights'])] : acc),
            []
          );

          const dataGrants = await Promise.all(
            dataGrantsUris.map(dataGrantUri =>
              ctx.call('ldp.remote.get', {
                resourceUri: dataGrantUri,
                jsonContext,
                accept: MIME_TYPES.JSON
              })
            )
          );

          // CHECK THAT GRANTS MATCH WITH ACCESS NEEDS

          filteredContainer = await ctx.call('access-needs-groups.list', {
            filters: {
              'http://www.w3.org/ns/solid/interop#accessNecessity': 'http://www.w3.org/ns/solid/interop#AccessRequired'
            },
            accept: MIME_TYPES.JSON
          });

          const requiredAccessNeedGroups = arrayOf(filteredContainer['ldp:contains']);

          // Return true if all access needs and special rights of the required AccessNeedGroups are granted
          const accessNeedsSatisfied = requiredAccessNeedGroups.every(
            group =>
              arrayOf(group['interop:hasAccessNeed']).every(accessNeedUri =>
                dataGrants.some(dataGrant => dataGrant['interop:satisfiesAccessNeed'] === accessNeedUri)
              ) &&
              arrayOf(group['interop:hasSpecialRights']).every(specialRightUri =>
                specialRightsUris.some(sr => sr === specialRightUri)
              )
          );

          if (!accessNeedsSatisfied) {
            throw new MoleculerError('One or more required access needs have not been granted', 400, 'BAD REQUEST');
          }

          // SEND BACK ACCEPT ACTIVITY

          await ctx.call('activitypub.outbox.post', {
            collectionUri: outboxUri,
            type: ACTIVITY_TYPES.ACCEPT,
            object: activity.id,
            to: activity.actor
          });

          // STORE LOCALLY APP REGISTRATION AND GRANTS

          await ctx.call('ldp.remote.store', { resource: appRegistration });
          await ctx.call('app-registrations.attach', { resourceUri: appRegistration.id || appRegistration['@id'] });

          for (const accessGrant of accessGrants) {
            await ctx.call('ldp.remote.store', { resource: accessGrant });
            await ctx.call('access-grants.attach', { resourceUri: accessGrant.id || accessGrant['@id'] });
          }

          for (const dataGrant of dataGrants) {
            await ctx.call('ldp.remote.store', { resource: dataGrant });
            await ctx.call('data-grants.attach', { resourceUri: dataGrant.id || dataGrant['@id'] });
          }

          await ctx.emit('app.registered', { appRegistration, accessGrants, dataGrants });
        } catch (e) {
          if (e.code !== 400) console.error(e);
          await ctx.call('activitypub.outbox.post', {
            collectionUri: outboxUri,
            type: ACTIVITY_TYPES.REJECT,
            summary: e.message,
            object: activity.id,
            to: activity.actor
          });
        }
      }
    },
    deleteAppRegistration: {
      match: {
        type: ACTIVITY_TYPES.DELETE,
        object: {
          type: 'interop:ApplicationRegistration'
        }
      },
      async onReceive(ctx, activity) {
        const appRegistration = await ctx.call('app-registrations.getForActor', { actorUri: activity.actor });

        // This will also delete the associated access grants and data grants
        await ctx.call('app-registrations.delete', {
          resourceUri: appRegistration.id || appRegistration['@id'],
          webId: 'system'
        });
      }
    }
  }
};
