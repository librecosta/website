import { ContactExperience } from '@/components/contact/ContactExperience';
import { sitePage } from '../site-page';

export const contact = sitePage('/contact', 'CONTACT', {
  zh: {
    metadata: { title: 'Contact | LibreCosta' },
    render: () => <ContactExperience />,
  },
});
