module.exports = [
  {
    path: '/files',
    excludeFromMirror: true,
    // TODO load all images with tokens so files can be hidden by default
    // https://javascript.plainenglish.io/loading-images-with-authorization-8aab33663ba6
    newResourcesPermissions: { anon: { read: true } }
  }
];
