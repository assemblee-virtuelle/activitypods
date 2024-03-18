import React, { useMemo, useEffect } from 'react';
import { useGetIdentity, useRedirect } from 'react-admin';
import { ThemeProvider } from '@mui/system';
import { createTheme } from '@mui/material/styles';
import { StyledEngineProvider } from '@mui/material';
import PodLoginPageView from './PodLoginPageView';

const PodLoginPage = props => {
  const muiTheme = useMemo(() => createTheme(props.theme), [props.theme]);
  const { identity, isLoading } = useGetIdentity();
  const redirect = useRedirect();

  // If user is already logged in, redirect to homepage
  useEffect(() => {
    if (!isLoading && identity?.id) {
      redirect('/');
    }
  }, [identity, isLoading, redirect]);

  if (isLoading || identity?.id) return null;

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <PodLoginPageView {...props} />
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default PodLoginPage;
