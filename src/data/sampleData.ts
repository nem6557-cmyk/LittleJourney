import { User, Child } from '../types';

// ── Users ──
export const parentUser: User = {
  id: 'p1',
  name: 'Sarah Ahmed',
  role: 'parent',
  email: 'sarah@email.com',
  phone: '+1 (555) 123-4567',
};

export const caregiverUser: User = {
  id: 'c1',
  name: 'Ms. Rivera',
  role: 'caregiver',
  email: 'rivera@sunshineacademy.com',
  phone: '+1 (555) 987-6543',
};

// ── Children ──
export const layla: Child = {
  id: 'child1',
  firstName: 'Layla',
  lastName: 'Ahmed',
  dateOfBirth: '2023-06-15',
  classroom: 'Butterfly Room',
  allergies: ['Peanuts', 'Shellfish'],
  emergencyContacts: [
    { name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567' },
    { name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678' },
    { name: 'Fatima Ahmed', relationship: 'Grandmother', phone: '+1 (555) 345-6789' },
  ],
  authorizedPickups: [
    { id: 'ap1', name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567', verified: true },
    { id: 'ap2', name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678', verified: true },
    { id: 'ap3', name: 'Fatima Ahmed', relationship: 'Grandmother', phone: '+1 (555) 345-6789', verified: true },
  ],
  pediatrician: 'Dr. Williams',
};

export const adam: Child = {
  id: 'child9',
  firstName: 'Adam',
  lastName: 'Ahmed',
  dateOfBirth: '2021-11-03',
  classroom: 'Ladybug Room',
  allergies: [],
  emergencyContacts: [
    { name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567' },
    { name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678' },
  ],
  authorizedPickups: [
    { id: 'ap1', name: 'Sarah Ahmed', relationship: 'Mother', phone: '+1 (555) 123-4567', verified: true },
    { id: 'ap2', name: 'Omar Ahmed', relationship: 'Father', phone: '+1 (555) 234-5678', verified: true },
  ],
  pediatrician: 'Dr. Williams',
};
