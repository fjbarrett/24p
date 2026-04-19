import { apiFetch } from "@/lib/api-client";

export type UserProfile = {
  userEmail: string;
  username: string;
  isPublic: boolean;
  streamingNotifications: boolean;
  priceNotifications: boolean;
  createdAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getProfile(userEmail: string): Promise<UserProfile | null> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to load profile");
  }
  try {
    const data = await apiFetch<{ profile: UserProfile | null }>(`/profiles`);
    return data.profile ?? null;
  } catch (error) {
    console.error("Failed to load profile", error);
    return null;
  }
}

export async function setUsername(userEmail: string, username: string): Promise<UserProfile> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to set username");
  }
  const data = await apiFetch<{ profile: UserProfile }>(`/profiles/username`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  return data.profile;
}

export async function setProfileVisibility(userEmail: string, isPublic: boolean): Promise<UserProfile> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to update profile visibility");
  }
  const data = await apiFetch<{ profile: UserProfile }>(`/profiles/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ isPublic }),
  });
  return data.profile;
}

export async function setPriceNotifications(userEmail: string, enabled: boolean): Promise<UserProfile> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required");
  }
  const data = await apiFetch<{ profile: UserProfile }>(`/profiles/price-notifications`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return data.profile;
}

export async function setStreamingNotifications(userEmail: string, enabled: boolean): Promise<UserProfile> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required");
  }
  const data = await apiFetch<{ profile: UserProfile }>(`/profiles/notifications`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return data.profile;
}

export async function getPublicProfile(username: string): Promise<UserProfile | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    throw new Error("username is required to load a public profile");
  }
  try {
    const data = await apiFetch<{ profile: UserProfile }>(
      `/profiles/public/${encodeURIComponent(normalized)}`,
    );
    return data.profile ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === "Profile not found") {
      return null;
    }
    console.error("Failed to load public profile", error);
    return null;
  }
}
