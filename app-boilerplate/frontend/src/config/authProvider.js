import { authProvider } from '@semapps/auth-provider';
import dataProvider from './dataProvider';

export default authProvider({
  dataProvider,
  authType: 'solid-oidc',
  checkPermissions: true,
  allowAnonymous: false,
  clientId: process.env.REACT_APP_BACKEND_CLIENT_ID
});
