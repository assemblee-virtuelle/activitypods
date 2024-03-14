import React from 'react';
import { useGetOne } from 'react-admin';
import { Badge, Avatar } from '@mui/material';

const AppBadge = ({ appUri, large, children }) => {
  const { data: app } = useGetOne('App', { id: appUri }, { enabled: !!appUri, staleTime: Infinity });
  if (!app) return children;
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={
        <Avatar
          alt={app['interop:applicationName']}
          src={app['interop:applicationThumbnail']}
          sx={{ width: large ? 45 : 22, height: large ? 45 : 22, bgcolor: 'white' }}
        />
      }
    >
      {children}
    </Badge>
  );
};

export default AppBadge;
