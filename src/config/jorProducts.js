'use strict';

const PRODUCTS = Object.freeze({
  jor_char_shellback: product('\u041f\u0430\u043d\u0446\u0438\u0440\u043d\u0438\u043a', 'Shellback', 5, 19),
  jor_char_swifttail: product('\u0411\u044b\u0441\u0442\u0440\u043e\u0445\u0432\u043e\u0441\u0442', 'Swifttail', 10, 49),
  jor_char_glutton: product('\u0413\u043b\u043e\u0442\u0430\u0442\u0435\u043b\u044c', 'Glutton', 16, 79),
  jor_char_hunter: product('\u041e\u0445\u043e\u0442\u043d\u0438\u043a', 'Hunter', 27, 139),
  jor_char_abyssal: product('\u0413\u043b\u0443\u0431\u0438\u043d\u043d\u044b\u0439', 'Abyssal', 38, 199),
  jor_growth_bubbles: product('\u041f\u0443\u0437\u044b\u0440\u044c\u043a\u043e\u0432\u044b\u0439 \u0441\u043a\u0430\u0447\u043e\u043a', 'Bubble Burst', 5, 19),
  jor_growth_pulse: product('\u0413\u043e\u043b\u0443\u0431\u043e\u0439 \u0438\u043c\u043f\u0443\u043b\u044c\u0441', 'Cyan Pulse', 13, 59),
  jor_growth_deepglow: product('\u0413\u043b\u0443\u0431\u0438\u043d\u043d\u043e\u0435 \u0441\u0438\u044f\u043d\u0438\u0435', 'Deep Glow', 27, 139),
  jor_growth_abyssrings: product('\u041a\u043e\u043b\u044c\u0446\u0430 \u0431\u0435\u0437\u0434\u043d\u044b', 'Abyss Rings', 52, 279),
  jor_growth_legendary: product('\u041b\u0435\u0433\u0435\u043d\u0434\u0430\u0440\u043d\u0430\u044f \u044d\u0432\u043e\u043b\u044e\u0446\u0438\u044f', 'Legendary Evolution', 75, 399),
  jor_pet_medusa: product('\u041b\u0443\u043d\u043d\u0430\u044f \u043c\u0435\u0434\u0443\u0437\u0430', 'Moon Jelly', 20, 99),
  jor_pet_kaplik: product('\u041a\u0430\u043f\u043b\u0438\u043a', 'Droplet', 35, 179),
  jor_pet_toothlet: product('\u0417\u0443\u0431\u0430\u0441\u0442\u0438\u043a', 'Toothlet', 60, 319),
  jor_pet_pink_glutton: product('\u0420\u043e\u0437\u043e\u0432\u044b\u0439 \u041e\u0431\u0436\u043e\u0440\u043a\u0430', 'Pink Glutton', 90, 479),
  jor_pet_ancient: product('\u0414\u0440\u0435\u0432\u043d\u0438\u0439 \u041e\u0431\u0436\u043e\u0440\u0430', 'Ancient Glutton', 125, 679),
  jor_icon_orange_eye: product('\u041e\u0440\u0430\u043d\u0436\u0435\u0432\u044b\u0439 \u0433\u043b\u0430\u0437\u0430\u0441\u0442\u0438\u043a', 'Orange Eye', 5, 19),
  jor_icon_red_fish: product('\u041a\u0440\u0430\u0441\u043d\u0430\u044f \u0440\u044b\u0431\u043a\u0430', 'Red Fish', 7, 29),
  jor_icon_aqua_shell: product('\u0411\u0438\u0440\u044e\u0437\u043e\u0432\u044b\u0439 \u043f\u0430\u043d\u0446\u0438\u0440\u043d\u0438\u043a', 'Aqua Shell', 9, 39),
  jor_icon_dark_eye: product('\u0422\u0451\u043c\u043d\u044b\u0439 \u0433\u043b\u0430\u0437 \u0433\u043b\u0443\u0431\u0438\u043d\u044b', 'Deep Eye', 13, 59),
  jor_icon_gold_shell: product('\u0417\u043e\u043b\u043e\u0442\u043e\u0439 \u043f\u0430\u043d\u0446\u0438\u0440\u043d\u0438\u043a', 'Gold Shell', 18, 89),
  jor_icon_ancient_eye: product('\u041b\u0435\u0432\u0438\u0430\u0444\u0430\u043d', 'Leviathan', 23, 119),
  jor_no_side_ads_30d: product('\u0411\u0435\u0437 \u0440\u0435\u043a\u043b\u0430\u043c\u044b \u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0443\u043d\u0434\u043e\u0432 \u043d\u0430 30 \u0434\u043d\u0435\u0439', 'No ads after rounds for 30 days', 10, 79, 30),
  jor_no_reward_ads: product('\u0422\u0440\u0435\u0442\u0438\u0439 \u0432\u044b\u0431\u043e\u0440 \u0431\u0435\u0437 \u0440\u0435\u043a\u043b\u0430\u043c\u044b', 'Ad-free third choice', 45, 239)
});

function product(titleRu, titleEn, vkVotes, okAmount, durationDays = 0) {
  return Object.freeze({ titleRu, titleEn, vkVotes, okAmount, durationDays });
}

module.exports = { JOR_PRODUCTS: PRODUCTS };
