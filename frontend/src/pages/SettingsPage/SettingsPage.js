import React, { useEffect, useState } from 'react';
import { useCheckAuthenticated } from '@semapps/auth-provider';
import { useTranslate, useGetList, useAuthProvider, useNotify, useCreatePath, useGetIdentity } from 'react-admin';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton
} from '@mui/material';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import makeStyles from '@mui/styles/makeStyles';
import { useNavigate } from 'react-router-dom';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import useContactLink from '../../hooks/useContactLink';

const useStyles = makeStyles(() => ({
  listItem: {
    backgroundColor: 'white',
    padding: 0,
    marginBottom: 8,
    boxShadow: '0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)'
  },
  listItemText: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    marginRight: 32
  }
}));

const SettingsPage = () => {
  const translate = useTranslate();
  const authProvider = useAuthProvider();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  const createPath = useCreatePath();
  const notify = useNotify();
  const [accountSettings, setAccountSettings] = useState({});
  useCheckAuthenticated();
  const classes = useStyles();

  const { data } = useGetList('Location');
  const contactLink = useContactLink();

  useEffect(() => {
    authProvider.getAccountSettings().then(res => setAccountSettings(res));
  }, [setAccountSettings, authProvider]);

  const settings = [
    {
      path: createPath({ resource: 'Profile', id: identity?.profileData?.id, type: 'edit' }),
      icon: <PersonIcon />,
      label: 'app.setting.profile',
      value: identity?.fullName
    },
    {
      path: '/Location',
      icon: <PlaceIcon />,
      label: 'app.setting.addresses',
      value: translate('app.setting.address', { smart_count: data ? data.length : 0 })
    },
    {
      path: '/settings/email',
      icon: <EmailIcon />,
      label: 'app.setting.email',
      value: accountSettings.email
    },
    {
      path: '/settings/password',
      icon: <LockIcon />,
      label: 'app.setting.password',
      value: '***************'
    }
  ];

  return (
    <>
      <Typography variant="h2" component="h1" sx={{ mt: 2 }}>
        {translate('app.page.settings')}
      </Typography>
      <Box>
        <List>
          {settings.map(setting => (
            <ListItem className={classes.listItem} key={setting.path}>
              <ListItemButton onClick={() => navigate(setting.path)}>
                <ListItemAvatar>
                  <Avatar>{setting.icon}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={translate(setting.label)}
                  secondary={setting.value}
                  className={classes.listItemText}
                />
                <ListItemSecondaryAction>
                  <IconButton>
                    <EditIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItemButton>
            </ListItem>
          ))}
          <ListItem className={classes.listItem}>
            <CopyToClipboard text={contactLink}>
              <ListItemButton onClick={() => notify('app.notification.contact_link_copied', { type: 'success' })}>
                <ListItemAvatar>
                  <Avatar>
                    <LinkIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={translate('app.card.share_contact')}
                  secondary={contactLink}
                  className={classes.listItemText}
                />
                <ListItemSecondaryAction>
                  <IconButton>
                    <FileCopyIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItemButton>
            </CopyToClipboard>
          </ListItem>
        </List>
      </Box>
    </>
  );
};

export default SettingsPage;
