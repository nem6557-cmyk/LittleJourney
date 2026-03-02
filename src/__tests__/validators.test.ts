import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  daycareOnboardingSchema,
  classroomSchema,
  inviteCodeSchema,
  childSchema,
  messageSchema,
  timelineEntrySchema,
  incidentSchema,
  profileUpdateSchema,
} from '../lib/validators';

// ============================================================
// loginSchema
// ============================================================

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects empty fields', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
  });
});

// ============================================================
// signUpSchema
// ============================================================

describe('signUpSchema', () => {
  const validSignUp = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    password: 'Secure1pass',
    confirmPassword: 'Secure1pass',
    role: 'parent' as const,
    agreeToTerms: true,
  };

  it('accepts valid sign up data', () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: 'Different1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'nouppercase1', confirmPassword: 'nouppercase1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without number', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'NoNumberHere', confirmPassword: 'NoNumberHere' });
    expect(result.success).toBe(false);
  });

  it('rejects if terms not agreed', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, agreeToTerms: false });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, role: 'superadmin' });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// forgotPasswordSchema
// ============================================================

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

// ============================================================
// daycareOnboardingSchema
// ============================================================

describe('daycareOnboardingSchema', () => {
  const validDaycare = {
    name: 'Sunshine Daycare',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    phone: '512-555-1234',
    email: 'info@sunshine.com',
  };

  it('accepts valid daycare data', () => {
    expect(daycareOnboardingSchema.safeParse(validDaycare).success).toBe(true);
  });

  it('accepts zip+4 format', () => {
    expect(daycareOnboardingSchema.safeParse({ ...validDaycare, zip: '78701-1234' }).success).toBe(true);
  });

  it('rejects invalid state code', () => {
    expect(daycareOnboardingSchema.safeParse({ ...validDaycare, state: 'XX' }).success).toBe(false);
  });

  it('rejects invalid zip', () => {
    expect(daycareOnboardingSchema.safeParse({ ...validDaycare, zip: '123' }).success).toBe(false);
  });

  it('rejects invalid phone', () => {
    expect(daycareOnboardingSchema.safeParse({ ...validDaycare, phone: '12' }).success).toBe(false);
  });
});

// ============================================================
// classroomSchema
// ============================================================

describe('classroomSchema', () => {
  it('accepts valid classroom', () => {
    expect(classroomSchema.safeParse({ name: 'Butterflies', capacity: 15 }).success).toBe(true);
  });

  it('defaults capacity to 12', () => {
    const result = classroomSchema.safeParse({ name: 'Stars' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capacity).toBe(12);
  });

  it('rejects capacity over 50', () => {
    expect(classroomSchema.safeParse({ name: 'Big Room', capacity: 100 }).success).toBe(false);
  });
});

// ============================================================
// inviteCodeSchema
// ============================================================

describe('inviteCodeSchema', () => {
  it('accepts valid 8-char uppercase alphanumeric code', () => {
    expect(inviteCodeSchema.safeParse({ code: 'ABCD1234' }).success).toBe(true);
  });

  it('rejects lowercase', () => {
    expect(inviteCodeSchema.safeParse({ code: 'abcd1234' }).success).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(inviteCodeSchema.safeParse({ code: 'ABC' }).success).toBe(false);
  });
});

// ============================================================
// childSchema
// ============================================================

describe('childSchema', () => {
  it('accepts valid child data', () => {
    const result = childSchema.safeParse({
      firstName: 'Emma',
      lastName: 'Smith',
      dateOfBirth: '2022-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = childSchema.safeParse({
      firstName: 'Emma',
      lastName: 'Smith',
      dateOfBirth: '06/15/2022',
    });
    expect(result.success).toBe(false);
  });

  it('defaults allergies to empty array', () => {
    const result = childSchema.safeParse({
      firstName: 'Emma',
      lastName: 'Smith',
      dateOfBirth: '2022-06-15',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.allergies).toEqual([]);
  });
});

// ============================================================
// messageSchema
// ============================================================

describe('messageSchema', () => {
  it('accepts valid message', () => {
    expect(messageSchema.safeParse({ text: 'Hello!' }).success).toBe(true);
  });

  it('rejects empty message', () => {
    expect(messageSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('defaults isUrgent to false', () => {
    const result = messageSchema.safeParse({ text: 'Hey' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isUrgent).toBe(false);
  });
});

// ============================================================
// timelineEntrySchema
// ============================================================

describe('timelineEntrySchema', () => {
  const validEntry = {
    childId: '550e8400-e29b-41d4-a716-446655440000',
    activityType: 'meal' as const,
    title: 'Lunch',
  };

  it('accepts valid timeline entry', () => {
    expect(timelineEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it('rejects invalid activity type', () => {
    expect(timelineEntrySchema.safeParse({ ...validEntry, activityType: 'swimming' }).success).toBe(false);
  });

  it('rejects non-uuid childId', () => {
    expect(timelineEntrySchema.safeParse({ ...validEntry, childId: 'not-a-uuid' }).success).toBe(false);
  });
});

// ============================================================
// incidentSchema
// ============================================================

describe('incidentSchema', () => {
  const validIncident = {
    childId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'fall' as const,
    severity: 'minor' as const,
    description: 'Child tripped and fell on the playground during recess',
    actionTaken: 'Applied ice pack and consoled the child',
  };

  it('accepts valid incident report', () => {
    expect(incidentSchema.safeParse(validIncident).success).toBe(true);
  });

  it('rejects too-short description', () => {
    expect(incidentSchema.safeParse({ ...validIncident, description: 'short' }).success).toBe(false);
  });

  it('rejects invalid severity', () => {
    expect(incidentSchema.safeParse({ ...validIncident, severity: 'critical' }).success).toBe(false);
  });
});

// ============================================================
// profileUpdateSchema
// ============================================================

describe('profileUpdateSchema', () => {
  it('accepts valid profile update', () => {
    expect(profileUpdateSchema.safeParse({ firstName: 'John', phone: '555-123-4567' }).success).toBe(true);
  });

  it('accepts empty phone (allows clearing)', () => {
    expect(profileUpdateSchema.safeParse({ phone: '' }).success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(true);
  });
});
