import React from 'react';
import { Admin, Resource, memoryStore } from 'react-admin';
import { BrowserRouter } from 'react-router-dom';
import { StyledEngineProvider } from '@mui/material/styles';
import PodLoginPage from './pages/PodLoginPage/PodLoginPage';

import authProvider from './config/authProvider';
import dataProvider from './config/dataProvider';
import i18nProvider from './config/i18nProvider';
import * as resources from './resources';

const customPodProviders = process.env.REACT_APP_POD_PROVIDER_DOMAIN_NAME && [
  { 'apods:domainName': process.env.REACT_APP_POD_PROVIDER_DOMAIN_NAME, 'apods:area': 'Local' }
];

const LoginPage = props => <PodLoginPage customPodProviders={customPodProviders} {...props} />;

const App = () => (
  <StyledEngineProvider injectFirst>
    <BrowserRouter>
      <Admin
        title={process.env.REACT_APP_NAME}
        authProvider={authProvider}
        dataProvider={dataProvider}
        i18nProvider={i18nProvider}
        loginPage={LoginPage}
        store={memoryStore()}
        requireAuth
      >
        {Object.entries(resources).map(([key, resource]) => (
          <Resource key={key} name={key} {...resource.config} />
        ))}
      </Admin>
    </BrowserRouter>
  </StyledEngineProvider>
);

export default App;
