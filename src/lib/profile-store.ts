import { rustApiFetch } from "@/lib/rust-api-client";

export type UserProfile = {
  userEmail: string;
  username: string;
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
    const data = await rustApiFetch<{ profile: UserProfile | null }>(
      `/profiles?userEmail=${encodeURIComponent(email)}`,
    );
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
  const data = await rustApiFetch<{ profile: UserProfile }>(`/profiles/username`, {
    method: "POST",
    body: JSON.stringify({ userEmail: email, username }),
  });
  return data.profile;
}
