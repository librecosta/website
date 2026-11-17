'use client';

import { AudioProvider } from '@/components/audio/AudioProvider';
import { usesOriginalLayout } from '@/site/content';
import { instrumentFont } from '@/site/instrument-font';
import { ErrorExperience, type ErrorExperienceProps } from './ErrorExperience';
import '@/app/globals.css';

export function ErrorDocument(props: ErrorExperienceProps) {
  const { defaultLocale } = props.publication;
  return <html lang={defaultLocale} className={instrumentFont.variable} data-localized={!usesOriginalLayout(defaultLocale) || undefined}>
    <body>
      <AudioProvider><ErrorExperience {...props} /></AudioProvider>
    </body>
  </html>;
}
