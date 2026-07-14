import { apiFetch } from "@/lib/api-client";

export type UserProfile = {
  userEmail: string;
  username: string;
  isPublic: boolean;
  createdAt: string;
};

// A profile as exposed on public/unauthenticated surfaces — never carries email.
export type PublicProfile = Omit<UserProfile, "userEmail">;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
