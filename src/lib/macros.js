// Compute macros for `grams` of a food whose macros are stored per 100g.
export const calc = (food, grams) => ({
  cal: Math.round((grams / 100) * (food.cal || 0)),
  protein: Math.round((grams / 100) * (food.protein || 0) * 10) / 10,
  carbs: Math.round((grams / 100) * (food.carbs || 0) * 10) / 10,
  fat: Math.round((grams / 100) * (food.fat || 0) * 10) / 10,
})

// Normalize a measured serving (e.g. 150g => 200 kcal) to per-100g.
export const toPer100g = (serving, value) =>
  serving > 0 ? Math.round((Number(value || 0) / serving) * 100 * 10) / 10 : 0
