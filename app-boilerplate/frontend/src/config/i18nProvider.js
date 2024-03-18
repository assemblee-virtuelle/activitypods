import polyglotI18nProvider from 'ra-i18n-polyglot';
import raEnglishMessages from 'ra-language-english';
import raFrenchMessages from 'ra-language-french';
import { frenchMessages as authFrenchMessages, englishMessages as authEnglishMessages } from '@semapps/auth-provider';
import * as resources from '../resources';

const getMessages = lang => {
  if (lang === 'en') {
    return {
      ...raEnglishMessages,
      ...authEnglishMessages,
      resources: Object.fromEntries(
        Object.entries(resources).map(([k, v]) => [k, v.translations ? v.translations[lang] : {}])
      )
    };
  } else if (lang === 'fr') {
    return {
      ...raFrenchMessages,
      ...authFrenchMessages,
      resources: Object.fromEntries(
        Object.entries(resources).map(([k, v]) => [k, v.translations ? v.translations[lang] : {}])
      )
    };
  } else {
    throw new Error('Language not handled: ' + lang);
  }
};

const i18nProvider = polyglotI18nProvider(getMessages, process.env.REACT_APP_LANG);

export default i18nProvider;
