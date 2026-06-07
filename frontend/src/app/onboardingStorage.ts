const ONBOARDING_STORAGE_PREFIX = "steply:onboarding:";

function getOnboardingKey(userId: number) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

export function getOnboardingStatus(userId: number) {
  try {
    return localStorage.getItem(getOnboardingKey(userId));
  } catch {
    return null;
  }
}

export function setOnboardingStatus(userId: number, status: "pending" | "completed") {
  try {
    localStorage.setItem(getOnboardingKey(userId), status);
  } catch {
    // The onboarding can still finish for this session when storage is unavailable.
  }
}
