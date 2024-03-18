import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import AuthorizePageView from './AuthorizePageView';
import theme from '../../config/theme';

const AuthorizePage = () => {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const clientId = searchParams.get('client_id');
  const navigate = useNavigate();

  // If no clientId is provided, we are not connecting to an application so we can skip this screen
  // This happens when we go through the signup process (the ProfileCreatePage redirects here)
  useEffect(() => {
    if (!clientId) {
      if (redirectTo && redirectTo.startsWith('http')) {
        window.location.href = redirectTo;
      } else {
        navigate(redirectTo || '/');
      }
    }
  }, [navigate, clientId, redirectTo]);

  if (!clientId) return null;

  return (
    <ThemeProvider theme={theme}>
      <AuthorizePageView />
    </ThemeProvider>
  );
};

export default AuthorizePage;
