import { useSiteLocale } from '@/site/LocaleProvider';
import styles from './publication-compliance.module.css';

export function PublicationCompliance({ docked = false }: { docked?: boolean }) {
  const { compliance } = useSiteLocale();
  if (!compliance) return null;

  return <footer lang="zh" data-publication-compliance={docked ? 'docked' : 'flow'}
    className={`${styles.footer} ${docked ? styles.docked : styles.flow}`}>
    <span>{compliance.copyright}</span>
    <span className={styles.filings}>
      <a href={compliance.filingUrl}>{compliance.filing}</a>
      <a href={compliance.publicSecurityUrl} rel="noopener noreferrer" target="_blank">
        <img src={compliance.publicSecurityIcon} width={14} height={16} alt="" />
        {compliance.publicSecurity}
      </a>
    </span>
  </footer>;
}
