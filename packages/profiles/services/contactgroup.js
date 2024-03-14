const { ControlledContainerMixin } = require('@semapps/ldp');
const { ClassDescriptionMixin } = require('@activitypods/description');

module.exports = {
  name: 'profiles.contactgroup',
  mixins: [ControlledContainerMixin, ClassDescriptionMixin],
  settings: {
    // ControlledContainerMixin settings
    acceptedTypes: ['vcard:Group'],
    permissions: {},
    newResourcesPermissions: {},
    // ClassDescriptionMixin settings
    classDescription: {
      label: {
        en: 'Groups',
        fr: 'Groupes'
      },
      labelPredicate: 'vcard:label'
    }
  }
};
