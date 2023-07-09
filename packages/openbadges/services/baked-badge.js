const sharp = require("sharp");
const pngitxt = require('png-itxt');
const urlJoin = require('url-join');
const { Readable } = require("stream");
const { MIME_TYPES } = require('@semapps/mime-types');
const { ControlledContainerMixin } = require('@semapps/ldp');

module.exports = {
  name: 'openbadges.baked-badge',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/baked-badges',
    acceptedTypes: ['semapps:File'],
    newResourcesPermissions: { anon: { read: true } },
  },
  actions: {
    async bake(ctx) {
      const { assertion, webId } = ctx.params;

      const badge = await ctx.call('ldp.resource.get', {
        resourceUri: assertion.badge,
        accept: MIME_TYPES.JSON,
        webId
      });

      const badgeImage = await ctx.call('ldp.resource.get', {
        resourceUri: badge['schema:image'],
        forceSemantic: true,
        accept: MIME_TYPES.JSON,
        webId
      });

      const bakedBadgeContainerUri = urlJoin(webId, 'data', 'baked-badges');

      const bakedBadgeUri = await ctx.call('ldp.resource.generateId', {
        containerUri: bakedBadgeContainerUri
      })

      const framedAssertion = await ctx.call('jsonld.frame', {
        input: {
          ...assertion,
          'schema:image': {
            '@id': bakedBadgeUri
          }
        },
        frame: {
          '@context': 'https://openbadgespec.org/v2/context.json',
          '@id': assertion.id
        }
      });

      const buffer = await sharp('./' + badgeImage['semapps:localPath']).png().toBuffer();
      const readableStream = Readable.from(buffer);
      const bakedFileStream = await readableStream.pipe(pngitxt.set({ keyword: 'openbadges', value: JSON.stringify(framedAssertion)} ));

      // TODO see why we can't use ldp.container.post

      const bakedBadge = await ctx.call('ldp.resource.upload', {
        resourceUri: bakedBadgeUri,
        file: {
          encoding: badgeImage['semapps:encoding'],
          mimetype: badgeImage['semapps:mimeType'],
          readableStream: bakedFileStream,
        }
      });

      await ctx.call('triplestore.insert', {
        resource: `<${bakedBadgeContainerUri}> <http://www.w3.org/ns/ldp#contains> <${bakedBadgeUri}>`,
        webId
      });

      await ctx.call('ldp.resource.create', {
        resource: bakedBadge,
        contentType: MIME_TYPES.JSON,
        webId
      });

      return bakedBadgeUri;
    }
  },
  methods: {
    readBadgeMetadata(stream) {
      return new Promise((resolve, reject) => {
        stream.pipe(pngitxt.getitxt('openbadges', (err, data) => {
          if (err || !data) {
            reject(err || 'No data found');
          } else {
            resolve(JSON.parse(data.value.replace(/\x00/,'')));
          }
        }))
      });
    }
  },
  hooks: {
    before: {
      async post(ctx) {
        const { file } = ctx.params;
        const { webId } = ctx.meta;

        const assertion = await this.readBadgeMetadata(file.readableStream);

        const assertionsContainerUri = urlJoin(webId, 'data', 'assertions');

        console.log('assertion', assertion);

        console.log('sparql', `
            PREFIX ldp: <http://www.w3.org/ns/ldp#>
            INSERT DATA { <${assertionsContainerUri}> ldp:contains <${assertion.id}>. };
          `);

        await ctx.call('ldp.container.patch', {
          containerUri: assertionsContainerUri,
          sparqlUpdate: `
            PREFIX ldp: <http://www.w3.org/ns/ldp#>
            INSERT DATA { <${assertionsContainerUri}> ldp:contains <${assertion.id}>. };
          `,
          webId
        })
      }
    }
  }
};
