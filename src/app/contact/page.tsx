import type { Metadata } from 'next';
import { ContactExperience } from './ContactExperience';

export const metadata: Metadata = { title: 'Contact | LibreCosta' };

export default function ContactPage() {
  return <ContactExperience />;
}
