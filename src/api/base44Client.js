import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { localBackendClient } from './localBackendClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;
export const isLocalBackend = import.meta.env.VITE_API_PROVIDER === 'local';

//Create a client with authentication required
const base44SdkClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

export const base44 = isLocalBackend ? localBackendClient : base44SdkClient;
