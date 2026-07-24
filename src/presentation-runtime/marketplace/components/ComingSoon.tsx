import React from 'react';
import { useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const ComingSoon: React.FC = () => {
 const location = useLocation();
 const path = location.state?.path || location.pathname;

 return (
 <div className={styles.page}>
 <div className={styles.placeholder}>
 <Hammer />
 <h2>Under Construction</h2>
 <p>The <code>{path}</code> module is not yet available in this environment.</p>
 </div>
 </div>
 );
};
