// Beta street (founder ruling, 3 Sep 2026): during the beta every neighbour
// moves in free — the subscription gate does not exist yet (P1 billing; the
// server move-in endpoint deliberately carries no entitlement check), and
// beta testers on the QA build must be able to fill the whole street without
// going through a purchase flow that isn't built.
//
// QA builds only. Prod keeps the free-petak gate (first neighbour free, the
// rest wait for billing) until the subscription play ships.
export const BETA_OPEN_STREET = process.env.EXPO_PUBLIC_PETAK_ENV === 'qa';
