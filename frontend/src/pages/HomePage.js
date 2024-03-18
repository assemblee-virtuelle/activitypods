import React, { useEffect } from 'react';
import { Box, Button, Typography, ThemeProvider, useMediaQuery, Container, Avatar } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import { Link, useGetIdentity, useTranslate, useRedirect } from 'react-admin';
import theme from '../config/theme';

const useStyles = makeStyles(() => ({
  '@global': {
    body: {
      backgroundColor: theme.palette.primary.main
    }
  },
  circle: {
    borderRadius: '50%',
    backgroundColor: 'white',
    padding: 30,
    height: 460,
    width: 460,
    position: 'absolute',
    top: -100,
    [theme.breakpoints.down('sm')]: {
      width: '100vw',
      height: '100vw',
      padding: 0,
      top: -70
    }
  },
  title: {
    fontWeight: '800',
    paddingTop: 50
  },
  text: {
    color: 'white'
  },
  logo: {
    fontSize: 100,
    color: 'white'
  },
  button: {
    margin: 5
  },
  stepsTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 15
  },
  steps: {
    marginTop: 400,
    [theme.breakpoints.down('sm')]: {
      marginTop: 'calc(100vw - 30px)'
    }
  },
  step: {
    position: 'relative',
    paddingLeft: 90,
    marginBottom: 25,
    '& h4': {
      [theme.breakpoints.down('sm')]: {
        fontWeight: 'bold',
        lineHeight: '1.2em',
        marginBottom: 8
      }
    }
  },
  number: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 70,
    height: 70,
    fontWeight: 'bold',
    color: theme.palette.primary.main,
    backgroundColor: 'white',
    fontSize: 50
  }
}));

const HomePage = () => {
  const classes = useStyles();
  const { data: identity, isLoading } = useGetIdentity();
  const redirect = useRedirect();
  const translate = useTranslate();
  const xs = useMediaQuery(() => theme.breakpoints.down('sm'), { noSsr: true });

  useEffect(() => {
    if (!isLoading && identity?.id) {
      redirect('/Profile');
    }
  }, [redirect, isLoading, identity]);

  if (isLoading || identity?.id) return null;

  console.log('isLoading', isLoading, identity);

  return (
    <ThemeProvider theme={theme}>
      <Box display="flex" justifyContent="center">
        <Box className={classes.circle} display="flex" alignItems="center" justifyContent="center">
          <Box>
            <Typography align="center" variant="h1" className={classes.title}>
              {process.env.REACT_APP_NAME}
            </Typography>
            <Typography align="center">{process.env.REACT_APP_DESCRIPTION}</Typography>
            <Box
              display="flex"
              flexDirection={xs ? 'column' : 'row'}
              pt={3}
              pb={3}
              alignItems="center"
              justifyContent="center"
            >
              <Link to="/login?signup">
                <Button variant="contained" color="secondary" className={classes.button}>
                  {translate('auth.action.signup')}
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="contained" color="secondary" className={classes.button}>
                  {translate('ra.auth.sign_in')}
                </Button>
              </Link>
            </Box>
          </Box>
        </Box>
        <Box className={classes.steps}>
          <Typography variant="h2" align="center" className={classes.stepsTitle}>
            {translate('app.steps.title')}
          </Typography>
          <Container>
            {[1, 2, 3, 4].map(i => (
              <Box className={classes.step} key={i}>
                <Avatar className={classes.number}>{i}</Avatar>
                <Typography variant="h4">{translate(`app.steps.${i}.title`)}</Typography>
                <Typography>{translate(`app.steps.${i}.text`)}</Typography>
              </Box>
            ))}
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default HomePage;
