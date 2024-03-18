import React, { useState, useEffect, useCallback } from 'react';
import { useGetIdentity, useTranslate } from 'react-admin';
import { BottomNavigation, BottomNavigationAction, Box, AppBar } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import { Link, useLocation } from 'react-router-dom';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AppsIcon from '@mui/icons-material/Apps';
import SettingsIcon from '@mui/icons-material/Settings';

const useStyles = makeStyles(theme => ({
  box: {
    height: 56
  },
  appBar: {
    top: 'auto',
    bottom: 0
  },
  bottomNav: {
    borderTopColor: theme.palette.primary.main,
    borderTopStyle: 'solid',
    borderTopWidth: 4,
    '& a': {
      boxSizing: 'border-box'
    }
  },
  selected: {
    color: 'black',
    '& svg': {
      fill: 'black'
    }
  }
}));

const BottomBar = () => {
  const classes = useStyles();
  const [value, setValue] = useState();
  const translate = useTranslate();
  const { data: identity } = useGetIdentity();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/Profile/' + encodeURIComponent(identity?.profileData?.id)) {
      setValue('profile');
    } else if (location.pathname.startsWith('/Profile')) {
      setValue('contacts');
    } else if (location.pathname.startsWith('/App')) {
      setValue('apps');
    } else if (location.pathname.startsWith('/settings')) {
      setValue('settings');
    }
  }, [location.pathname, identity, setValue]);

  const onChange = useCallback(
    (e, newValue) => {
      setValue(newValue);
    },
    [setValue]
  );

  return (
    <>
      <Box className={classes.box} />
      <AppBar position="fixed" color="primary" className={classes.appBar}>
        <BottomNavigation showLabels className={classes.bottomNav} value={value} onChange={onChange}>
          <BottomNavigationAction
            label={translate('app.page.contacts_short')}
            value="contacts"
            icon={<PeopleAltIcon />}
            component={Link}
            to="/Profile"
            classes={{ selected: classes.selected }}
          />
          <BottomNavigationAction
            label={translate('app.page.apps_short')}
            value="apps"
            icon={<AppsIcon />}
            component={Link}
            to="/AppRegistration"
            classes={{ selected: classes.selected }}
          />
          <BottomNavigationAction
            label={translate('app.page.profile_short')}
            value="profile"
            icon={<AssignmentIndIcon />}
            component={Link}
            to={'/Profile/' + encodeURIComponent(identity?.profileData?.id)}
            classes={{ selected: classes.selected }}
          />
          <BottomNavigationAction
            label={translate('app.page.settings_short')}
            value="settings"
            icon={<SettingsIcon />}
            component={Link}
            to="/settings"
            classes={{ selected: classes.selected }}
          />
        </BottomNavigation>
      </AppBar>
    </>
  );
};

export default BottomBar;
