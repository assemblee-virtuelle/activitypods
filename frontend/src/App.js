import React from 'react';
import { Admin, Resource, CustomRoutes, memoryStore } from 'react-admin';
import { BrowserRouter, Route } from 'react-router-dom';
import { StyledEngineProvider } from '@mui/material/styles';
import { LocalLoginPage } from '@semapps/auth-provider';

import authProvider from './config/authProvider';
import dataProvider from './config/dataProvider';
import i18nProvider from './config/i18nProvider';
import * as resources from './resources';

import Layout from './layout/Layout';
import theme from './config/theme';
import scorer from './config/scorer';

import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import SettingsPasswordPage from './pages/SettingsPage/SettingsPasswordPage';
import SettingsEmailPage from './pages/SettingsPage/SettingsEmailPage';
import ProfileCreatePage from './pages/ProfileCreatePage/ProfileCreatePage';
import AuthorizePage from './pages/AuthorizePage/AuthorizePage';
import UserPage from './pages/UserPage';
import RedirectPage from './pages/RedirectPage';
import InvitePage from './pages/InvitePage/InvitePage';

const LoginPage = () => (
  <LocalLoginPage
    allowUsername
    postSignupRedirect="/initialize"
    postLoginRedirect="/authorize"
    additionalSignupValues={{ preferredLocale: process.env.REACT_APP_LANG }}
    passwordScorer={scorer}
  />
);

const App = () => (
  <StyledEngineProvider injectFirst>
    <BrowserRouter>
      <Admin
        title={process.env.REACT_APP_NAME}
        authProvider={authProvider}
        dataProvider={dataProvider}
        i18nProvider={i18nProvider}
        loginPage={LoginPage}
        layout={Layout}
        theme={theme}
        store={memoryStore()}
      >
        {Object.entries(resources).map(([key, resource]) => (
          <Resource key={key} name={key} {...resource.config} />
        ))}
        <CustomRoutes noLayout>
          <Route path="/" element={<HomePage />} />
          <Route path="/u/:id" element={<UserPage />} />
          <Route path="/r" element={<RedirectPage />} />
          <Route path="/initialize" element={<ProfileCreatePage />} />
          <Route path="/authorize" element={<AuthorizePage />} />
          <Route path="/invite/:capability" element={<InvitePage />} />
        </CustomRoutes>

        <CustomRoutes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/email" element={<SettingsEmailPage />} />
          <Route path="/settings/password" element={<SettingsPasswordPage />} />
        </CustomRoutes>
      </Admin>
    </BrowserRouter>
  </StyledEngineProvider>
);

export default App;
