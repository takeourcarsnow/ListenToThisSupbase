// Export the main app state for use in notification helpers
import DB from './db.js';
import { currentUser } from '../auth/auth.js';

export const state = {
  user: null,
  queue: [],
  qIndex: 0,
  pageSize: 30,
  page: 1,
  forceLogin: false
};

// Optionally, you can add a function to refresh the user
export async function refreshUser() {
  state.user = await currentUser(DB);
}