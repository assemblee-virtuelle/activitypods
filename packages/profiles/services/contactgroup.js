const { ControlledContainerMixin } = require('@semapps/ldp');

module.exports = {
  name: 'profiles.contactgroup',
  mixins: [ControlledContainerMixin],
  settings: {
    // ControlledContainerMixin settings
    acceptedTypes: ['vcard:Group'],
    permissions: {},
    newResourcesPermissions: {}
  }
};
