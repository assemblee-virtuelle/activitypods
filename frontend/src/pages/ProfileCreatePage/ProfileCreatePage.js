import React, { useMemo, useEffect } from 'react';
import { useGetIdentity, EditBase, useNotify, useRedirect } from 'react-admin';
import { ThemeProvider } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import ProfileCreatePageView from './ProfileCreatePageView';
import theme from '../../config/theme';

const ProfileCreatePage = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const { data: identity, refetch: refetchIdentity } = useGetIdentity();
  const [searchParams] = useSearchParams();

  const redirectPath = useMemo(() => {
    const redirectUrl = searchParams.get('redirect');
    const clientId = searchParams.get('client_id');
    if (clientId) {
      return `/authorize?redirect=${encodeURIComponent(redirectUrl)}&client_id=${encodeURIComponent(clientId)}`;
    }
    return redirectUrl || '/';
  }, [searchParams]);

  // Reload profile unless profile is created
  useEffect(() => {
    if (!identity?.profileData?.id) {
      setTimeout(refetchIdentity, 1000);
    }
  }, [identity, refetchIdentity]);

  if (!identity?.profileData?.id) return null;

  return (
    <ThemeProvider theme={theme}>
      <EditBase
        resource="Profile"
        basePath="/Profile"
        id={identity?.profileData?.id}
        mutationMode="pessimistic"
        mutationOptions={{
          onSuccess: () => {
            notify('ra.notification.updated', {
              messageArgs: { smart_count: 1 },
              undoable: false
            });
            refetchIdentity();
            redirect(redirectPath);
          }
        }}
      >
        <ProfileCreatePageView />
      </EditBase>
    </ThemeProvider>
  );
};

export default ProfileCreatePage;
