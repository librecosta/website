import { homePage } from '../locale-contract';
import { publication } from '../publication';
import { about } from './about';
import { world } from './world';
import { works } from './works';
import { contact } from './contact';
import { indexingAllowed, websiteSchema } from '../seo';

const pages = { about, world, works, contact };
const homeContent = pages[homePage(publication.id)];

export const home = {
  ...homeContent,
  Page: function HomePage() {
    return <>
      {indexingAllowed(publication) &&
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema(publication)).replace(/</g, '\\u003c'),
        }} />}
      <homeContent.Page />
    </>;
  },
};
