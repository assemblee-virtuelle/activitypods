import EventCreate from './EventCreate';
import EventEdit from './EventEdit';
import EventList from './EventList';
import EventShow from './EventShow';
import EventIcon from '@mui/icons-material/Event';

export default {
  config: {
    list: EventList,
    show: EventShow,
    create: EventCreate,
    edit: EventEdit,
    icon: EventIcon,
    recordRepresentation: 'vcard:given-name'
  },
  dataModel: {
    types: ['as:Event']
  },
  translations: {
    en: {
      name: 'Event |||| Events',
      fields: {
        describes: 'User ID',
        'vcard:given-name': 'Surname',
        'vcard:family-name': 'Family name',
        'vcard:note': 'About you',
        'vcard:photo': 'Picture',
        'vcard:hasAddress': 'Home address',
        'dc:created': 'Account created'
      }
    },
    fr: {
      name: 'Evénement |||| Evénements',
      fields: {
        describes: 'Identifiant',
        'vcard:given-name': 'Prénom',
        'vcard:family-name': 'Nom de famille',
        'vcard:note': 'En deux mots',
        'vcard:photo': 'Photo',
        'vcard:hasAddress': 'Adresse du domicile',
        'dc:created': "Date d'inscription"
      }
    }
  }
};
