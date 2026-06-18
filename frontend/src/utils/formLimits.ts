export const authLimits = {
  fullNameMinLength: 2,
  fullNameMaxLength: 255,
  passwordMinLength: 10,
  passwordMaxLength: 128
} as const;

export const habitLimits = {
  titleMinLength: 2,
  titleMaxLength: 160,
  descriptionMaxLength: 1200
} as const;

export const petLimits = {
  nameMinLength: 1,
  nameMaxLength: 80
} as const;
