const JOIN_EVENT_MAPPING = {
  key: 'join_event',
  title: {
    en: `{{emitterProfile.vcard:given-name}} joined your event "{{activity.object.name}}"`,
    fr: `{{emitterProfile.vcard:given-name}} s'est inscrit(e) à votre événement "{{activity.object.name}}"`
  },
  actionName: {
    en: 'View',
    fr: 'Voir'
  },
  actionLink: "/e/{{encodeUri activity.object.id}}"
};

const LEAVE_EVENT_MAPPING = {
  key: 'leave_event',
  title: {
    en: `{{emitterProfile.vcard:given-name}} left your event "{{activity.object.name}}"`,
    fr: `{{emitterProfile.vcard:given-name}} s'est désinscrit(e) de votre événement "{{activity.object.name}}"`
  },
  actionName: {
    en: 'View',
    fr: 'Voir'
  },
  actionLink: "/e/{{encodeUri activity.object.id}}"
};

// const NEW_MESSAGE_ABOUT_EVENT_MAPPING = {
//   key: 'new_message_about_event',
//   title: {
//     en: `{{emitterProfile.vcard:given-name}} writes you about "{{activity.object.context.name}}"`,
//     fr: `{{emitterProfile.vcard:given-name}} vous écrit au sujet de "{{activity.object.context.name}}"`
//   },
//   description: '{{activity.object.content}}',
//   actionName: {
//     en: 'Reply',
//     fr: 'Répondre'
//   },
//   actionLink: "/Profile/{{encodeUri emitterProfile.id}}/show"
// };

const POST_EVENT_CONTACT_REQUEST_MAPPING = {
  key: 'post_event_contact_request',
  title: {
    en: `Add {{emitterProfile.vcard:given-name}} to your network`,
    fr: `Ajoutez {{emitterProfile.vcard:given-name}} à votre réseau`
  },
  description: {
    en: `Following the event {{activity.context.name}}, you have the possibility to add {{emitterProfile.vcard:given-name}} to your network.`,
    fr: `Suite à l'événement {{activity.context.name}}, vous avez la possibilité d'ajouter {{emitterProfile.vcard:given-name}} à vos contacts.`
  },
  actionName: {
    en: 'View',
    fr: 'Voir'
  },
  actionLink: "/Profile"
};

module.exports = {
  JOIN_EVENT_MAPPING,
  LEAVE_EVENT_MAPPING,
  // NEW_MESSAGE_ABOUT_EVENT_MAPPING,
  POST_EVENT_CONTACT_REQUEST_MAPPING
};
