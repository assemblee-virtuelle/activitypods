const path = require('path');
const urlJoin = require('url-join');
const fetch = require('node-fetch');
const { initialize, initializeAppServer, clearDataset, listDatasets, installApp } = require('./initialize');
const ExampleAppService = require('./apps/example.app');
const { parseHeader, negotiateContentType, parseJson } = require('@semapps/middlewares');
const { fetchServer, tryUntilTimeout } = require('./utils');
const { delay } = require('@semapps/ldp');
const { WebSocket } = require('ws');
const { MIME_TYPES } = require('@semapps/mime-types');
const { triple, namedNode, literal } = require('@rdfjs/data-model');

jest.setTimeout(110_000);

const POD_SERVER_BASE_URL = 'http://localhost:3000';
const APP_SERVER_BASE_URL = 'http://localhost:3001';
const APP_URI = urlJoin(APP_SERVER_BASE_URL, 'app');

const mockWebhookAction = jest.fn(() => Promise.resolve());
const mockWebhookAction2 = jest.fn(() => Promise.resolve());

describe('Test app installation', () => {
  let podServer, alice, appServer, webhookChannelSubscriptionUrl, webSocketChannelSubscriptionUrl, webhookChannelUri;

  beforeAll(async () => {
    const datasets = await listDatasets();
    for (const dataset of datasets) {
      await clearDataset(dataset);
    }

    podServer = await initialize(3000, 'settings');
    await podServer.loadService(path.resolve(__dirname, './services/profiles.app.js'));
    await podServer.start();

    appServer = await initializeAppServer(3001, 'appData', 'app_settings');
    await appServer.createService(ExampleAppService);
    await appServer.createService({
      name: 'fake-service',
      actions: { webhook: mockWebhookAction, webhook2: mockWebhookAction2 }
    });
    await appServer.start();
    await appServer.call('api.addRoute', {
      route: {
        path: '/fake-webhook',
        authorization: false,
        authentication: false,
        aliases: {
          'POST /': [parseHeader, negotiateContentType, parseJson, 'fake-service.webhook']
        },
        bodyParsers: false
      }
    });

    const actorData = require(`./data/actor1.json`);
    const { webId } = await podServer.call('auth.signup', actorData);
    alice = await podServer.call(
      'activitypub.actor.awaitCreateComplete',
      {
        actorUri: webId,
        additionalKeys: ['url']
      },
      { meta: { dataset: actorData.username } }
    );
    alice.call = (actionName, params, options = {}) =>
      podServer.call(actionName, params, {
        ...options,
        meta: { ...options.meta, webId, dataset: alice.preferredUsername }
      });

    await installApp(alice, APP_URI);
  }, 110_000);

  afterAll(async () => {
    podServer.stop();
    appServer.stop();
  });

  test('User installs app and grants all access needs', async () => {
    const { json: storage } = await fetchServer(urlJoin(POD_SERVER_BASE_URL, '.well-known/solid'));

    expect(storage['@type']).toBe('http://www.w3.org/ns/pim/space#Storage');
    expect(storage['notify:subscription']).toHaveLength(2);

    [webSocketChannelSubscriptionUrl, webhookChannelSubscriptionUrl] = storage['notify:subscription'];

    const { json: webhookChannelSubscription } = await fetchServer(webhookChannelSubscriptionUrl);
    const { json: webSocketChannelSubscription } = await fetchServer(webSocketChannelSubscriptionUrl);

    expect(webSocketChannelSubscription).toMatchObject({
      'notify:channelType': 'notify:WebSocketChannel2023',
      'notify:feature': ['notify:endAt', 'notify:rate', 'notify:startAt', 'notify:state']
    });

    expect(webhookChannelSubscription).toMatchObject({
      'notify:channelType': 'notify:WebhookChannel2023',
      'notify:feature': ['notify:endAt', 'notify:rate', 'notify:startAt', 'notify:state']
    });
  });

  describe('webhooks', () => {
    test('Cannot create webhook channel without read rights', async () => {
      // Alice profile is not public
      const { status } = await fetchServer(webhookChannelSubscriptionUrl, {
        method: 'POST',
        headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
        body: {
          '@context': {
            notify: 'http://www.w3.org/ns/solid/notifications#'
          },
          '@type': 'notify:WebhookChannel2023',
          'notify:topic': alice.url,
          'notify:sendTo': urlJoin(APP_SERVER_BASE_URL, 'fake-webhook')
        }
      });

      expect(status).toBe(403);
    });

    test('Cannot create webhook channel for unexisting resources', async () => {
      const { status } = await fetchServer(webhookChannelSubscriptionUrl, {
        method: 'POST',
        headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
        body: {
          '@context': {
            notify: 'http://www.w3.org/ns/solid/notifications#'
          },
          '@type': 'notify:WebhookChannel2023',
          'notify:topic': `${alice.url}-unexisting`,
          'notify:sendTo': urlJoin(APP_SERVER_BASE_URL, 'fake-webhook')
        }
      });

      expect(status).toBe(400);
    });

    test('Create webhook channel as registered app', async () => {
      const { body } = await appServer.call('signature.proxy.query', {
        url: webhookChannelSubscriptionUrl,
        method: 'POST',
        headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
        body: JSON.stringify({
          '@context': {
            notify: 'http://www.w3.org/ns/solid/notifications#'
          },
          '@type': 'notify:WebhookChannel2023',
          'notify:topic': alice.outbox,
          'notify:sendTo': urlJoin(APP_SERVER_BASE_URL, 'fake-webhook')
        }),
        actorUri: APP_URI
      });

      webhookChannelUri = body.id;

      const webhookChannelContainer = await alice.call('solid-notifications.provider.webhook.getContainerUri', {
        webId: alice.id
      });
      await expect(
        alice.call('ldp.container.includes', {
          containerUri: webhookChannelContainer,
          resourceUri: webhookChannelUri
        })
      ).resolves.toBeTruthy();

      expect(body).toMatchObject({
        type: 'notify:WebhookChannel2023',
        'notify:topic': alice.outbox,
        'notify:sendTo': urlJoin(APP_SERVER_BASE_URL, 'fake-webhook')
      });
    });

    test('Listen to Alice outbox', async () => {
      const activity = await alice.call('activitypub.outbox.post', {
        collectionUri: alice.outbox,
        type: 'Event',
        content: 'Birthday party !'
      });

      await tryUntilTimeout(async () => {
        expect(mockWebhookAction).toHaveBeenCalledTimes(1);
      }, 10000);

      expect(mockWebhookAction.mock.calls[0][0].params).toMatchObject({
        '@context': ['https://www.w3.org/ns/activitystreams', 'https://www.w3.org/ns/solid/notifications-context/v1'],
        type: 'Add',
        object: activity.id || activity['@id'],
        target: alice.outbox
      });
    });

    test('Delete webhook channel', async () => {
      const response = await appServer.call('signature.proxy.query', {
        url: webhookChannelUri,
        method: 'DELETE',
        actorUri: APP_URI
      });

      expect(response.status).toBe(204);

      await alice.call('activitypub.outbox.post', {
        collectionUri: alice.outbox,
        type: 'Event',
        content: 'Birthday party 2 !'
      });

      await delay(5000);

      expect(mockWebhookAction).not.toHaveBeenCalledTimes(2);
    });

    test('Listen to Alice outbox through listener', async () => {
      await appServer.call('solid-notifications.listener.register', {
        resourceUri: alice.outbox,
        actionName: 'fake-service.webhook2'
      });

      const activity = await alice.call('activitypub.outbox.post', {
        collectionUri: alice.outbox,
        type: 'Event',
        content: 'Birthday party 3 !'
      });

      await tryUntilTimeout(async () => {
        expect(mockWebhookAction2).toHaveBeenCalledTimes(1);
      }, 10_000);

      expect(mockWebhookAction2.mock.calls[0][0].params).toMatchObject({
        '@context': ['https://www.w3.org/ns/activitystreams', 'https://www.w3.org/ns/solid/notifications-context/v1'],
        type: 'Add',
        object: activity.id || activity['@id'],
        target: alice.outbox
      });
    });
  });

  describe('web sockets', () => {
    test('Cannot create web socket channel without read rights', async () => {
      // Alice profile is not public
      const { status } = await fetchServer(webSocketChannelSubscriptionUrl, {
        method: 'POST',
        headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
        body: {
          '@context': {
            notify: 'http://www.w3.org/ns/solid/notifications#'
          },
          '@type': 'notify:WebSocketChannel2023',
          'notify:topic': alice.url
        }
      });

      expect(status).toBe(403);
    });

    test('Cannot create web socket channel for non-existing resources', async () => {
      const { status } = await fetchServer(webSocketChannelSubscriptionUrl, {
        method: 'POST',
        headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
        body: {
          '@context': {
            notify: 'http://www.w3.org/ns/solid/notifications#'
          },
          '@type': 'notify:WebSocketChannel2023',
          'notify:topic': `${alice.url}-unexisting`
        }
      });

      expect(status).toBe(400);
    });

    describe('collection and resource subscription.', () => {
      let collectionUri,
        noteUri,
        collectionWebSocket,
        itemWebSocket,
        webSocketCollectionChannelUri,
        webSocketItemChannelUri;
      const collectionActivities = [];
      const itemActivities = [];

      beforeAll(async () => {
        collectionUri = await appServer.call('pod-collections.createAndAttach', {
          resourceUri: alice.id,
          attachPredicate: 'http://activitypods.org/ns/core#my-notes',
          collectionOptions: {
            ordered: false,
            summary: 'My notes',
            dereferenceItems: false
          },
          actorUri: alice.id
        });

        await alice.call('webacl.resource.addRights', {
          webId: 'system',
          resourceUri: urlJoin(alice.id, 'data/as'),
          additionalRights: {
            anon: {
              uri: APP_URI,
              read: true,
              write: true,
              append: true,
              control: true
            }
          }
        });

        noteUri = await alice.call('ldp.container.post', {
          containerUri: urlJoin(alice.id, 'data/as'),
          resource: {
            '@context': 'https://www.w3.org/ns/activitystreams',
            '@type': 'Note',
            name: `A new collection note`,
            content: `The note content.`
          },
          contentType: MIME_TYPES.JSON
        });
        await alice.call('webacl.resource.addRights', {
          webId: 'system',
          resourceUri: noteUri,
          additionalRights: {
            anon: {
              uri: APP_URI,
              read: true,
              write: true,
              append: true,
              control: true
            }
          }
        });
      });

      test('Create web socket channels as registered app', async () => {
        // Create channel for listing to collection changes.

        const { body: collectionChannelBody } = await appServer.call('signature.proxy.query', {
          url: webSocketChannelSubscriptionUrl,
          method: 'POST',
          headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
          body: JSON.stringify({
            '@context': {
              notify: 'http://www.w3.org/ns/solid/notifications#'
            },
            '@type': 'notify:WebSocketChannel2023',
            'notify:topic': collectionUri
          }),
          actorUri: APP_URI
        });
        expect(collectionChannelBody.id).toBeTruthy();
        webSocketCollectionChannelUri = collectionChannelBody.id;

        console.log('Created channel for collection', collectionChannelBody);
        collectionWebSocket = new WebSocket(collectionChannelBody['notify:receiveFrom']);
        collectionWebSocket.addEventListener('message', e => {
          collectionActivities.push(JSON.parse(e.data));
        });

        // Create channel for listening to item changes.
        const { body: itemChannelBody } = await appServer.call('signature.proxy.query', {
          url: webSocketChannelSubscriptionUrl,
          method: 'POST',
          headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
          body: JSON.stringify({
            '@context': {
              notify: 'http://www.w3.org/ns/solid/notifications#'
            },
            '@type': 'notify:WebSocketChannel2023',
            'notify:topic': noteUri
          }),
          actorUri: APP_URI
        });
        expect(itemChannelBody.id).toBeTruthy();
        webSocketItemChannelUri = itemChannelBody.id;

        console.log('Created channel for item', itemChannelBody);
        itemWebSocket = new WebSocket(itemChannelBody['notify:receiveFrom']);
        itemWebSocket.addEventListener('message', e => {
          itemActivities.push(JSON.parse(e.data));
        });
      });

      test('add', async () => {
        await alice.call('activitypub.collection.add', {
          collectionUri,
          item: noteUri
        });

        await tryUntilTimeout(() => {
          expect(collectionActivities[collectionActivities.length - 1]).toMatchObject({
            '@context': [
              'https://www.w3.org/ns/activitystreams',
              'https://www.w3.org/ns/solid/notifications-context/v1'
            ],
            type: 'Add',
            object: noteUri,
            target: collectionUri
          });
        }, 10_000);
      });

      test('patch', async () => {
        await alice.call('ldp.resource.patch', {
          resourceUri: noteUri,
          triplesToAdd: [
            triple(namedNode(noteUri), namedNode('https://www.w3.org/ns/activitystreams#tag'), literal('My tag'))
          ]
        });

        await tryUntilTimeout(() => {
          expect(itemActivities[itemActivities.length - 1]).toMatchObject({
            type: 'Update',
            object: noteUri
          });
        }, 10_000);
      });

      test('delete', async () => {
        await alice.call('ldp.resource.delete', {
          resourceUri: noteUri,
          webId: 'system'
        });

        await tryUntilTimeout(() => {
          expect(itemActivities[itemActivities.length - 1]).toMatchObject({
            type: 'Delete',
            object: noteUri
          });
        }, 10_000);
        // Item is replaced by tombstone, and not removed.
        await tryUntilTimeout(() => {
          expect(collectionActivities[collectionActivities.length - 1]).not.toMatchObject({
            type: 'Remove',
            object: noteUri,
            target: collectionUri
          });
        }, 10_000);

        await alice.call('activitypub.collection.remove', { collectionUri: collectionUri, itemUri: noteUri });
        // Now the tombstone should be gone.
        await tryUntilTimeout(() => {
          expect(collectionActivities[collectionActivities.length - 1]).toMatchObject({
            type: 'Remove',
            object: noteUri,
            target: collectionUri
          });
        }, 10_000);
      });

      test('Delete web socket channels', async () => {
        console.log('Deleting collection channel', webSocketCollectionChannelUri);
        const responseDelCollection = await appServer.call('signature.proxy.query', {
          url: webSocketCollectionChannelUri,
          method: 'DELETE',
          actorUri: APP_URI
        });
        console.log('Deleting item channel', webSocketItemChannelUri);
        const responseDelItem = await appServer.call('signature.proxy.query', {
          url: webSocketItemChannelUri,
          method: 'DELETE',
          actorUri: APP_URI
        });
        expect(responseDelCollection.status).toBe(204);
        expect(responseDelItem.status).toBe(204);
        await delay(3_000);
        expect(collectionWebSocket.readyState).toBe(WebSocket.CLOSED);
        expect(itemWebSocket.readyState).toBe(WebSocket.CLOSED);
      });
    });

    describe('container subscription .', () => {
      let containerUri, resourceUri, containerWebSocket;
      const containerActivities = [];

      beforeAll(async () => {
        containerUri = urlJoin(alice.id, 'data/as');
        await alice.call('webacl.resource.addRights', {
          webId: 'system',
          resourceUri: containerUri,
          additionalRights: {
            anon: {
              uri: APP_URI,
              read: true,
              write: true,
              append: true,
              control: true
            }
          }
        });
      });

      test('Create web socket channel as registered app', async () => {
        const { body } = await appServer.call('signature.proxy.query', {
          url: webSocketChannelSubscriptionUrl,
          method: 'POST',
          headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
          body: JSON.stringify({
            '@context': {
              notify: 'http://www.w3.org/ns/solid/notifications#'
            },
            '@type': 'notify:WebSocketChannel2023',
            'notify:topic': containerUri
          }),
          actorUri: APP_URI
        });
        expect(body.id).toBeTruthy();

        containerWebSocket = new WebSocket(body['notify:receiveFrom']);
        containerWebSocket.addEventListener('message', e => {
          containerActivities.push(JSON.parse(e.data));
        });
      });

      test('add', async () => {
        resourceUri = await alice.call('ldp.container.post', {
          containerUri,
          resource: {
            '@context': 'https://www.w3.org/ns/activitystreams',
            '@type': 'Object',
            name: `Some object resource`,
            content: `I'm a resource with type as:Object.`
          },
          contentType: MIME_TYPES.JSON
        });

        await tryUntilTimeout(() => {
          expect(containerActivities[containerActivities.length - 1]).toMatchObject({
            '@context': [
              'https://www.w3.org/ns/activitystreams',
              'https://www.w3.org/ns/solid/notifications-context/v1'
            ],
            type: 'Add',
            object: resourceUri,
            target: containerUri
          });
        }, 10_000);
      });

      test('delete', async () => {
        await alice.call('ldp.resource.delete', {
          resourceUri: resourceUri,
          webId: 'system'
        });

        await tryUntilTimeout(() => {
          expect(containerActivities[containerActivities.length - 1]).toMatchObject({
            type: 'Remove',
            object: resourceUri,
            target: containerUri
          });
        }, 10_000);
      });
    });
  });
});
