// Who is using the app. There is no sign-in yet, so this is a fixed demo user.
// When sign-in is added, this is the one function to change: everything that
// needs the user's name, id or role (screens, saved replies, the AI prompt) asks here.

export type CurrentUser = {
  /** Stored as the owner of accounts and follow-ups. */
  id: string;
  name: string;
  firstName: string;
  role: string;
  initials: string;
};

const DEMO_USER: CurrentUser = {
  id: "You",
  name: "Mara Okafor",
  firstName: "Mara",
  role: "CS Manager",
  initials: "MO",
};

export function currentUser(): CurrentUser {
  return DEMO_USER;
}
