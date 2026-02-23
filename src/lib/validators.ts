import { z } from 'zod';

// ============================================================
// Auth Validators
// ============================================================

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signUpSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  role: z.enum(['parent', 'caregiver', 'admin']),
  agreeToTerms: z.boolean().refine(val => val === true, { message: 'You must agree to the Terms of Service' }),
  coppaConsent: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// ============================================================
// Daycare Onboarding Validators
// ============================================================

export const daycareOnboardingSchema = z.object({
  name: z.string().min(2, 'Daycare name is required').max(100),
  address: z.string().min(5, 'Address is required').max(200),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().length(2, 'Use 2-letter state code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  phone: z.string().regex(/^\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email'),
});

export const classroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required').max(50),
  ageGroup: z.string().optional(),
  capacity: z.number().int().min(1).max(50).default(12),
});

// ============================================================
// Invite Code Validator
// ============================================================

export const inviteCodeSchema = z.object({
  code: z.string().length(8, 'Invite code must be 8 characters').regex(/^[A-Z0-9]+$/, 'Invalid code format'),
});

// ============================================================
// Child Validators
// ============================================================

export const childSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  classroomId: z.string().uuid().optional(),
  allergies: z.array(z.string()).default([]),
  medicalNotes: z.string().max(1000).optional(),
});

// ============================================================
// Message Validators
// ============================================================

export const messageSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty').max(5000),
  isUrgent: z.boolean().default(false),
});

// ============================================================
// Timeline Entry Validators
// ============================================================

export const timelineEntrySchema = z.object({
  childId: z.string().uuid(),
  activityType: z.enum(['meal', 'nap', 'diaper', 'activity', 'milestone', 'photo', 'note', 'medication', 'checkin', 'checkout', 'mood', 'incident']),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  mood: z.enum(['happy', 'calm', 'sleepy', 'fussy', 'playful']).optional(),
  isUrgent: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

// ============================================================
// Incident Report Validator
// ============================================================

export const incidentSchema = z.object({
  childId: z.string().uuid(),
  type: z.enum(['fall', 'bite', 'scratch', 'bump', 'allergic_reaction', 'illness', 'other']),
  severity: z.enum(['minor', 'moderate', 'serious']),
  location: z.string().max(200).optional(),
  description: z.string().min(10, 'Please provide a detailed description').max(2000),
  actionTaken: z.string().min(5, 'Please describe the action taken').max(2000),
  witnessName: z.string().max(100).optional(),
});

// ============================================================
// Profile Validators
// ============================================================

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/, 'Invalid phone number').optional().or(z.literal('')),
});

// ============================================================
// Type exports (inferred from schemas)
// ============================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type DaycareOnboardingInput = z.infer<typeof daycareOnboardingSchema>;
export type ClassroomInput = z.infer<typeof classroomSchema>;
export type InviteCodeInput = z.infer<typeof inviteCodeSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type TimelineEntryInput = z.infer<typeof timelineEntrySchema>;
export type IncidentInput = z.infer<typeof incidentSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
