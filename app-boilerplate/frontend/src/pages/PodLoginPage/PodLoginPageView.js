import React, { useEffect, useState } from 'react';
import { useNotify, useLocaleState, useTranslate, useLogout } from 'react-admin';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Card,
  Typography
} from '@mui/material';
import { useNodeinfo } from '@semapps/activitypub-components';
import makeStyles from '@mui/styles/makeStyles';
import LockIcon from '@mui/icons-material/Lock';
import StorageIcon from '@mui/icons-material/Storage';

const useStyles = makeStyles(theme => ({
  '@global': {
    body: {
      backgroundColor: theme.palette.primary.main
    }
  },
  text: {
    textAlign: 'center',
    padding: '4px 8px 8px'
  },
  card: {
    minWidth: 300,
    maxWidth: 350,
    marginTop: '6em',
    [theme.breakpoints.down('sm')]: {
      margin: '1em'
    }
  },
  lockIconAvatar: {
    margin: '1em',
    display: 'flex',
    justifyContent: 'center'
  },
  lockIcon: {
    backgroundColor: theme.palette.grey['500']
  },
  list: {
    paddingTop: 0,
    paddingBottom: 0
  }
}));

const PodProvider = ({ podProvider, signup, appDomain }) => {
  const nodeinfo = useNodeinfo(podProvider['apods:domainName']);

  let url;
  if (nodeinfo) {
    url = new URL(signup ? nodeinfo?.metadata?.signup_url : nodeinfo?.metadata?.login_url);
    if (signup) url.searchParams.set('signup', 'true');
    url.searchParams.set('appDomain', appDomain);
  }

  return (
    <>
      <Divider />
      <ListItem>
        <ListItemButton component="a" href={url && url.toString()}>
          <ListItemAvatar>
            <Avatar>
              <StorageIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary={podProvider['apods:domainName']} secondary={podProvider['apods:area']} />
        </ListItemButton>
      </ListItem>
    </>
  );
};

const PodLoginPageView = ({ text, customPodProviders, appDomain }) => {
  const classes = useStyles();
  const notify = useNotify();
  const [searchParams] = useSearchParams();
  const [locale] = useLocaleState();
  const logout = useLogout();
  const translate = useTranslate();
  const [podProviders, setPodProviders] = useState(customPodProviders || []);

  useEffect(() => {
    (async () => {
      if (podProviders.length === 0) {
        const results = await fetch('https://data.activitypods.org/pod-providers', {
          headers: {
            Accept: 'application/ld+json'
          }
        });
        if (results.ok) {
          const json = await results.json();
          // Filter POD providers by available locales
          const podProviders = json['ldp:contains'].filter(provider =>
            Array.isArray(provider['apods:locales'])
              ? provider['apods:locales'].includes(locale)
              : provider['apods:locales'] === locale
          );
          setPodProviders(podProviders);
        } else {
          notify('auth.message.pod_providers_not_loaded', 'error');
        }
      }
    })();
  }, [podProviders, setPodProviders, notify, locale]);

  useEffect(() => {
    if (searchParams.has('logout')) {
      logout();
    }
  }, [searchParams, logout]);

  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Card className={classes.card}>
        <div className={classes.lockIconAvatar}>
          <Avatar className={classes.lockIcon}>
            <LockIcon />
          </Avatar>
        </div>
        <Box pl={2} pr={2}>
          <Typography variant="body2" className={classes.text}>
            {text || translate('auth.message.choose_pod_provider')}
          </Typography>
        </Box>
        <Box m={2}>
          <List className={classes.list}>
            {podProviders.map((podProvider, i) => (
              <PodProvider
                key={i}
                podProvider={podProvider}
                signup={searchParams.has('signup')}
                appDomain={appDomain}
              />
            ))}
          </List>
        </Box>
      </Card>
    </Box>
  );
};

export default PodLoginPageView;