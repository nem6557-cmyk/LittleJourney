export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const getRelativeTime = (isoString: string): string => {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatDateShort(isoString);
};

export const getActivityIcon = (type: string): string => {
  const icons: Record<string, string> = {
    meal: 'restaurant',
    nap: 'bed',
    diaper: 'baby-carriage',
    activity: 'palette',
    milestone: 'star',
    photo: 'camera',
    note: 'note-text',
    medication: 'medical-bag',
    checkin: 'login',
    checkout: 'logout',
    mood: 'emoticon-happy',
    incident: 'alert-circle',
  };
  return icons[type] || 'circle';
};

export const getActivityEmoji = (type: string): string => {
  const emojis: Record<string, string> = {
    meal: '🍽️',
    nap: '😴',
    diaper: '👶',
    activity: '🎨',
    milestone: '🌟',
    photo: '📸',
    note: '📝',
    medication: '💊',
    checkin: '✅',
    checkout: '👋',
    mood: '😊',
    incident: '🚨',
  };
  return emojis[type] || '📌';
};

export const getMoodEmoji = (mood?: string): string => {
  const moods: Record<string, string> = {
    happy: '😊',
    calm: '😌',
    sleepy: '😴',
    fussy: '😫',
    playful: '🤪',
  };
  return mood ? moods[mood] || '😊' : '';
};

export const getChildAge = (dob: string): string => {
  const birth = new Date(dob);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${remainingMonths} months`;
  if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}y ${remainingMonths}m`;
};
