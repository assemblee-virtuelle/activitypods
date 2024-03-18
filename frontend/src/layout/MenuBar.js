import React from 'react';
import { useGetIdentity, useTranslate, Link } from 'react-admin';
import { Box, Container, Breadcrumbs } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles(theme => ({
  menuBar: {
    backgroundColor: 'white',
    borderBottomColor: theme.palette.primary.main,
    borderBottomStyle: 'solid',
    borderBottomWidth: 4,
    position: 'relative',
    zIndex: 50
  },
  link: {
    fontSize: '14pt',
    color: 'black',
    fontWeight: '300',
    lineHeight: '2.2em'
  }
}));

const MenuBar = () => {
  const classes = useStyles();
  const translate = useTranslate();
  const { data: identity } = useGetIdentity();
  return (
    <Box className={classes.menuBar}>
      <Container>
        <Breadcrumbs separator="|">
          <Link to="/Profile" className={classes.link}>
            {translate('app.page.contacts')}
          </Link>
          <Link to="/AppRegistration" className={classes.link}>
            {translate('app.page.apps')}
          </Link>
          <Link to={'/Profile/' + encodeURIComponent(identity?.profileData?.id)} className={classes.link}>
            {translate('app.page.profile')}
          </Link>
          <Link to="/settings" className={classes.link}>
            {translate('app.page.settings')}
          </Link>
        </Breadcrumbs>
      </Container>
    </Box>
  );
};

export default MenuBar;
