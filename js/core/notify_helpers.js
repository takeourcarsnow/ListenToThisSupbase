// Notification integration for likes and comments
import notifications from '../core/notifications.js';

export function notifyPostLike(post, liker) {
  if (!post || !liker) return;
  if (post.userId === liker.id) return; // Don't notify self
  notifications.add(`Your post "${post.title}" received a like!`, 'info');
}

export function notifyPostComment(post, commenter) {
  if (!post || !commenter) return;
  if (post.userId === commenter.id) return; // Don't notify self
  notifications.add(`Your post "${post.title}" received a new comment!`, 'info');
}
