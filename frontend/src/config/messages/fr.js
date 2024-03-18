// Model https://github.com/marmelab/react-admin/blob/master/packages/ra-language-french/src/index.ts

module.exports = {
  app: {
    action: {
      accept: 'Accepter',
      accept_contact_request: 'Accepter la demande',
      add: 'Ajouter',
      add_contact: 'Ajouter contact',
      add_location: 'Ajouter une adresse',
      copy: 'Copier dans votre presse-papier',
      edit_profile: 'Éditer mon profil',
      ignore: 'Ignorer',
      ignore_contact: 'Ignorer',
      ignore_contact_request: 'Ignorer la demande',
      login: 'Se connecter',
      open_app: "Ouvrir l'appli",
      reject: 'Refuser',
      reject_contact_request: 'Rejeter la demande',
      remove_contact: 'Retirer de mes contacts',
      send: 'Envoyer',
      send_message: 'Envoyer un message',
      signup: "S'inscrire",
      reset_password: 'Mot de passe oublié ?',
      set_new_password: 'Definir un nouveau mot de passe',
      undo_ignore_contact: 'Ne plus ignorer',
      select: 'Sélectionner',
      connect: "Accepter l'invitation",
      continue: 'Continuer'
    },
    group: {
      members: 'Membres',
      no_members: "Le groupe n'a pas encore de membres",
      label: 'Nom du groupe',
      remove_members: 'Retirer sélection',
      profile_name: 'Nom',
      group: 'Groupe',
      profile: 'Profil',
      create: 'Nouveau groupe',
      add_members: 'Ajouter des membres'
    },
    page: {
      contacts: 'Mon réseau',
      contacts_short: 'Réseau',
      profile: 'Mon profil',
      profile_short: 'Profil',
      apps: 'Mes applications',
      apps_short: 'Applis',
      addresses: 'Mes adresses',
      settings: 'Paramètres',
      settings_short: 'Paramètres',
      settings_email: 'Modifier mon mail',
      settings_password: 'Modifier mon mot de passe',
      add_contact: 'Demander une mise en relation',
      create_profile: 'Créez votre profil',
      authorize: 'Autorisation requise',
      groups: 'Mes groupes',
      groups_short: 'Groupes',
      invite: '%{username} souhaite vous inviter dans son réseau',
      invite_loading: "Chargement de l'invitation...",
      invite_connect: '%{username} souhaite vous inviter dans son réseau',
      choose_provider: 'Choisissez un hébergeur',
      choose_custom_provider: 'Choisir un autre hébergeur',
      invite_success: 'Connection établie !'
    },
    setting: {
      email: 'Adresse mail',
      password: 'Mot de passe',
      addresses: 'Mes adresses',
      address: '%{smart_count} adresse |||| %{smart_count} adresses'
    },
    authorization: {
      required: 'Accès requis',
      optional: 'Accès optionnel',
      access_resources_of_type: '%{access_right} les ressources de type %{type}',
      read: 'Lire',
      append: 'Enrichir',
      write: 'Écrire',
      control: 'Administrer',
      read_inbox: 'Lire ma boîte de réception',
      read_outbox: "Lire ma boîte d'envoi",
      post_outbox: "Poster dans ma boîte d'envoi",
      send_notification: "M'envoyer des notifications",
      query_sparql_endpoint: 'Rechercher mes données',
      create_acl_group: 'Créer un groupe de permissions'
    },
    card: {
      add_contact: 'Ajouter un contact',
      contact_requests: 'Demandes de contact',
      share_contact: 'Mon lien de contact'
    },
    block: {
      contact_requests: 'Nouvelles demandes de contact',
      g1_account: 'Compte G1'
    },
    input: {
      about_you: 'Quelques mots sur vous',
      message: 'Message',
      user_id: 'Identifiant utilisateur',
      email: 'Email',
      current_password: 'Mot de passe actuel',
      new_password: 'Nouveau mot de passe',
      confirm_new_password: 'Confirmer le nouveau mot de passe',
      provider_url: "URL de l'espace personnel (POD)"
    },
    helper: {
      add_contact:
        "Pour faire une demande de mise en relation, vous devez connaître l'identifiant de la personne (au format @bob@serveur.com).",
      message_profile_show_right:
        'Envoyer un message à %{username} lui donnera le droit de voir votre profil, pour lui permettre de vous répondre.',
      profile_visibility: "Votre profil n'est visible que des personnes que vous avez accepté dans votre réseau",
      share_contact:
        'Pour vous connecter avec une personne que vous connaissez, vous pouvez lui envoyer le lien ci-dessous.',
      location_comment: 'Indications supplémentaires pour aider à trouver ce lieu',
      g1_tipjar_field:
        'Pour envoyer de la monnaie libre à cet utilisateur, copiez sa clé publique ci-dessous et utilisez-la dans le logiciel Cesium.',
      g1_tipjar_input:
        'La clé publique de votre compte Ğ1. Permet aux autres membres du réseau de facilement vous envoyer de la monnaie libre.',
      login: 'Je me connecte à mon espace personnel',
      signup: 'Je crée mon espace personnel',
      reset_password:
        'Entrez votre adresse mail ci-dessous et nous vous enverrons un lien pour réinitialiser votre mot de passe',
      set_new_password: 'Veuillez entrer votre adresse mail et un nouveau mot de passe ci-dessous',
      create_profile:
        'Maintenant que votre compte est créé, veuillez créer votre profil. Celui-ci ne sera visible par défaut que des personnes que vous acceptez dans votre réseau.',
      authorize: 'Autorisez-vous le site %{appDomain} à accéder à votre espace de données ?',

      invite_text_logged_out:
        "Un espace personnel est l'endroit où vous stockez vos données. Tout comme les comptes email, il est décentralisé, ce qui vous permet de choisir un fournisseur de confiance. Au lieu de créer un nouveau compte pour chaque nouvelle application, vous pourrez utiliser le même compte. Les applications compatibles stockeront les données dans votre espace.",

      invite_text_logged_in:
        "En acceptant l'invitation, %{username} sera ajouté à vos contacts. Par ailleurs, vous lui donnez le droit de voir votre profil et de vous ajouter à ses propre contacts",
      choose_provider_text_signup:
        'Comme pour les e-mails, vous pouvez décider où vous souhaitez créer votre espace personnel. Choisissez un hébergeur qui vous semble digne de confiance ou qui est proche de vous.',
      more_about_pods: 'En savoir plus sur les espaces de données.',
      choose_pod_provider:
        'The pod provider is the place where your data space is located. Like with an email provider, it will store your data.',
      choose_custom_provider:
        "Si l'hébergeur que vous recherchez n'est pas listé, vous pouvez entrer son adresse ci-dessous (par exemple https://mon-fournisseur.com)."
    },
    message: {
      copied_to_clipboard: 'Copié !',
      no_condition: 'Aucune',
      you_participated_to_same_event: 'Vous avez participé à la même rencontre',
      verified_app: 'Application vérifiée',
      verified: 'Vérifiée',
      no_app_registration: 'Aucune application installée',
      connection_successful: 'Vous êtes maintenant connecté !'
    },
    notification: {
      contact_request_accepted: 'Demande de contact acceptée',
      contact_request_ignored: 'Demande de contact ignorée',
      contact_request_rejected: 'Demande de contact refusée',
      contact_request_sent: 'Demande de contact envoyée',
      contact_removed: 'Contact supprimé',
      contact_ignored: 'Contact ignoré. Vous ne serez plus notifié de ses invitations.',
      contact_ignore_undone: 'Vous recevrez à nouveau les invitations de ce contact.',
      login_to_connect_user: 'Veuillez vous créer un compte pour vous connecter avec %{username}',
      message_sent: 'Votre message a bien été envoyé',
      message_send_error: "Erreur lors de l'envoi du message: %{error}",
      profile_data_not_found: "Votre profil n'a pas été trouvé, veuillez vous déconnecter et vous reconnecter",
      user_not_found: "L'utilisateur %{username} n'existe pas",
      reset_password_submitted: 'Un e-mail a été envoyé avec les instructions de réinitialisation du mot de passe',
      reset_password_error: "Une erreur s'est produite",
      password_changed: 'Le mot de passe a été changé avec succès',
      new_password_error: "Une erreur s'est produite",
      invalid_password: 'Mot de passe incorrect',
      get_settings_error: "Une erreur s'est produite",
      update_settings_error: "Une erreur s'est produite",
      verified_applications_load_failed: 'Impossible de charger la liste des applications vérifiées',
      app_uninstallation_in_progress: "Désinstallation de l'application en cours...",
      app_uninstalled: 'Application désinstallée',
      home_address_updated: 'Adresse du domicile mise à jour',
      home_address_deleted: 'Adresse du domicile enlevée',
      send_request_error: "Erreur lors de l'envoi de la demande : %{error}",
      connection_accepted: 'Vous avez accepté la demande de connexion.',
      invite_cap_invalid: "Le lien d'invitation n'est pas valide",
      invite_cap_fetch_error:
        "Une erreur s'est produite lors de la récupération de l'invitation. Elle pourrait ne pas être valide.\n%{error}",
      invite_cap_missing: "Impossible de générer un lien d'invitation (missing capability)",
      invite_cap_profile_fetch_error: "Erreur lors de la recherche du profil associé au lien d'invitation",
      pod_provider_fetch_error: "Erreur lors de la recherche d'autres hébergeurs : %{error}",
      contact_link_copied: 'Lien de contact copié avec succès',
      already_connected: "Tu es déjà connecté avec la personne qui t'a invité."
    },
    user: {
      unknown: 'Inconnu',
      location: 'Chez %{name}',
      member_since: 'Membre depuis'
    },
    validation: {
      email: 'Doit être un email valide',
      confirmNewPassword: 'Doit être le même que le nouveau champ de mot de passe',
      password_strength: 'Force du mot de passe',
      password_too_weak: 'Mot de passe trop faible. Augmentez la longueur ou ajoutez des caractères spéciaux.',
      url: 'Doit être une URL valide',
      uri: {
        no_http: 'Doit commencer par http:// ou https://',
        no_base_url: "L'URL doit se composer uniquement du domaine",
        no_tld: "L'URI doit avoir un TLD (par exemple `.com` ou `.net`)"
      }
    },
    steps: {
      title: 'Comment ça marche ?',
      1: {
        title: 'Je crée mon espace personnel (POD)',
        text: "Un seul endroit pour toutes mes données, c'est pas trop tôt !"
      },
      2: {
        title: 'Je me connecte aux applications compatibles',
        text: "Rencontres, petites annonces... et beaucoup d'autres à venir !"
      },
      3: {
        title: 'Mes données sont enregistrées sur mon POD',
        text: "Les administrateurs des applications n'y ont pas accès."
      },
      4: {
        title: 'Je choisis avec qui je partage mes données',
        text: 'A tout moment, je sais qui voit mes données. Je peux révoquer les droits.'
      }
    }
  }
};
