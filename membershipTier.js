export const normalizeMembershipTier = (membershipTier) =>
  membershipTier.charAt(0).toUpperCase() + membershipTier.slice(1).toLowerCase();
