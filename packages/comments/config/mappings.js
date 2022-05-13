const CREATE_COMMENT_MAPPING = {
  key: 'create_comment',
  title: {
    en: `{{emitterProfile.vcard:given-name}} commented about "{{activity.object.inReplyTo.name}}"`,
    fr: `{{emitterProfile.vcard:given-name}} a écrit un commentaire au sujet de "{{activity.object.inReplyTo.name}}"`
  },
  description: '{{activity.object.content}}',
  actionName: {
    en: 'Reply',
    fr: 'Répondre'
  },
  actionLink: "/e/{{encodeUri activity.object.id}}"
};

module.exports = {
  CREATE_COMMENT_MAPPING
};
