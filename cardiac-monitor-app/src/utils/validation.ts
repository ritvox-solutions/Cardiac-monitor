import { z } from 'zod';
import { ACTIVITY_LEVELS, GENDERS, HEALTH_PROFILE_LIMITS as LIMITS } from '../constants';

export const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const emergencyContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  relationship: z.string().min(2, 'Enter a relationship'),
});

export const healthProfileSchema = z.object({
  age: z.coerce.number()
    .min(LIMITS.AGE.MIN, `Age must be at least ${LIMITS.AGE.MIN}`)
    .max(LIMITS.AGE.MAX, `Age must be at most ${LIMITS.AGE.MAX}`),
  gender: z.enum(GENDERS),
  heightCm: z.coerce.number()
    .min(LIMITS.HEIGHT_CM.MIN, `Height must be at least ${LIMITS.HEIGHT_CM.MIN} cm`)
    .max(LIMITS.HEIGHT_CM.MAX, `Height must be at most ${LIMITS.HEIGHT_CM.MAX} cm`),
  weightKg: z.coerce.number()
    .min(LIMITS.WEIGHT_KG.MIN, `Weight must be at least ${LIMITS.WEIGHT_KG.MIN} kg`)
    .max(LIMITS.WEIGHT_KG.MAX, `Weight must be at most ${LIMITS.WEIGHT_KG.MAX} kg`),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  sleepHours: z.coerce.number()
    .min(LIMITS.SLEEP_HOURS.MIN, `Sleep must be at least ${LIMITS.SLEEP_HOURS.MIN} hours`)
    .max(LIMITS.SLEEP_HOURS.MAX, `Sleep must be at most ${LIMITS.SLEEP_HOURS.MAX} hours`),
  stressLevel: z.coerce.number()
    .min(LIMITS.STRESS_LEVEL.MIN, `Stress level must be at least ${LIMITS.STRESS_LEVEL.MIN}`)
    .max(LIMITS.STRESS_LEVEL.MAX, `Stress level must be at most ${LIMITS.STRESS_LEVEL.MAX}`),
  smoking: z.boolean(),
  diabetes: z.boolean(),
  hypertension: z.boolean(),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type EmergencyContactForm = z.infer<typeof emergencyContactSchema>;
export type HealthProfileForm = z.infer<typeof healthProfileSchema>;
