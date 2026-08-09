import * as SecureStore from 'expo-secure-store';
import client, { TOKEN_KEY } from './client';
import { clearAllCache } from './cache';

const SUCCESS_STATUSES = [200, 201, 202, 204];

function getErrorMessage(error, fallback) {
  if (typeof error?.response?.data === 'string') {
    return error.response.data;
  }

  return error?.response?.data?.message || error?.message || fallback;
}

async function clearLocalAuthState() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    clearAllCache(),
  ]);
}

export async function deleteAccount({ role, logout, user }) {
  const userId = user?.id;
  const endpoints =
    role === 'vendor'
      ? [
          { method: 'delete', url: '/vendor/account' },
          { method: 'delete', url: '/vendors/account' },
          { method: 'post', url: '/vendor/account/delete' },
          { method: 'post', url: '/vendor/account/delete-account' },
          { method: 'post', url: '/vendor/delete' },
          { method: 'delete', url: '/vendor/delete-account' },
          { method: 'post', url: '/vendor/delete-account' },
          { method: 'post', url: '/auth/delete-account' },
          { method: 'delete', url: '/auth/delete' },
          { method: 'post', url: '/auth/delete' },
          { method: 'post', url: '/account/delete' },
          { method: 'delete', url: '/account/delete' },
          { method: 'post', url: '/delete-account' },
          { method: 'delete', url: '/delete-account' },
          ...(userId ? [
            { method: 'delete', url: `/vendor/${userId}` },
            { method: 'delete', url: `/vendors/${userId}` },
            { method: 'delete', url: `/vendor/delete/${userId}` },
            { method: 'post', url: `/vendor/${userId}/delete` },
          ] : []),
        ]
      : [
          { method: 'delete', url: '/user/account' },
          { method: 'delete', url: '/users/account' },
          { method: 'post', url: '/user/account/delete' },
          { method: 'post', url: '/user/account/delete-account' },
          { method: 'post', url: '/user/delete' },
          { method: 'delete', url: '/user/delete' },
          { method: 'delete', url: '/user/delete-account' },
          { method: 'post', url: '/user/delete-account' },
          { method: 'post', url: '/auth/delete-account' },
          { method: 'delete', url: '/auth/delete' },
          { method: 'post', url: '/auth/delete' },
          { method: 'post', url: '/account/delete' },
          { method: 'delete', url: '/account/delete' },
          { method: 'post', url: '/delete-account' },
          { method: 'delete', url: '/delete-account' },
          ...(userId ? [
            { method: 'delete', url: `/users/${userId}` },
            { method: 'delete', url: `/user/${userId}` },
            { method: 'delete', url: `/users/${userId}/delete` },
            { method: 'delete', url: `/user/${userId}/delete` },
            { method: 'post', url: `/users/${userId}/delete` },
            { method: 'post', url: `/user/${userId}/delete` },
          ] : []),
        ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await client.request(endpoint);
      if (response && SUCCESS_STATUSES.includes(response.status)) {
        await clearLocalAuthState();
        await logout();
        return { success: true, synced: true };
      }

      lastError = new Error(response?.data?.message || 'Unable to delete account.');
    } catch (error) {
      const status = error?.response?.status;

      if (status === 404 || status === 405 || status === 400) {
        lastError = error;
        continue;
      }

      lastError = error;
      break;
    }
  }

  throw new Error(
    getErrorMessage(lastError, 'We could not complete account deletion from the server. Please try again or contact support.')
  );
}
