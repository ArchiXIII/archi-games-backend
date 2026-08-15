'use strict';

const PRODUCTS = Object.freeze({
  jor_char_shellback: product('Shellback', 5, 19),
  jor_char_swifttail: product('Swifttail', 10, 49),
  jor_char_glutton: product('Glutton', 16, 79),
  jor_char_hunter: product('Hunter', 27, 139),
  jor_char_abyssal: product('Abyssal', 38, 199),
  jor_growth_bubbles: product('Bubble Burst', 5, 19),
  jor_growth_pulse: product('Cyan Pulse', 13, 59),
  jor_growth_deepglow: product('Deep Glow', 27, 139),
  jor_growth_abyssrings: product('Abyss Rings', 52, 279),
  jor_growth_legendary: product('Legendary Evolution', 75, 399),
  jor_pet_medusa: product('Moon Jelly', 20, 99),
  jor_pet_kaplik: product('Droplet', 35, 179),
  jor_pet_toothlet: product('Toothlet', 60, 319),
  jor_pet_pink_glutton: product('Pink Glutton', 90, 479),
  jor_pet_ancient: product('Ancient Glutton', 125, 679),
  jor_icon_orange_eye: product('Orange Eye', 5, 19),
  jor_icon_red_fish: product('Red Fish', 7, 29),
  jor_icon_aqua_shell: product('Aqua Shell', 9, 39),
  jor_icon_dark_eye: product('Deep Eye', 13, 59),
  jor_icon_gold_shell: product('Gold Shell', 18, 89),
  jor_icon_ancient_eye: product('Leviathan', 23, 119),
  jor_no_side_ads_30d: product('More space for 30 days', 10, 49, 30),
  jor_no_reward_ads: product('Ad-free third choice', 45, 239)
});

function product(title, vkVotes, okAmount, durationDays = 0) {
  return Object.freeze({ title, vkVotes, okAmount, durationDays });
}

module.exports = { JOR_PRODUCTS: PRODUCTS };
