import { ContactExperience } from '@/components/contact/ContactExperience';
import { sitePage } from '../site-page';

export const contact = sitePage('/contact', 'CONTACT', {
  en: { metadata: { title: 'Contact | LibreCosta' }, render: () => <ContactExperience /> },
  zh: {
    metadata: { title: 'Contact | LibreCosta' },
    render: () => <ContactExperience />,
  },
});
