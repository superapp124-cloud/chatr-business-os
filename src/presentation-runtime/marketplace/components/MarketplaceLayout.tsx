import React, { useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
 Home, Store, Briefcase, BrainCircuit, Search, BarChart2, 
 Settings, Cable, Users, Shield, ArrowLeft, Hexagon, ChevronDown 
} from 'lucide-react';
import styles from './MarketplaceLayout.module.css';
import { KernelContext } from '../../providers/KernelProvider';
import { CommandPalette } from './CommandPalette';

export const MarketplaceLayout: React.FC = () => {
 const [isCommandOpen, setIsCommandOpen] = React.useState(false);
 const location = useLocation();
 const navigate = useNavigate();
 const context = useContext(KernelContext);

 if (!context) {
 return <div>Kernel Not Initialized</div>;
 }

 // Handle fake navigation for unimplemented routes to show placeholder
 const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
 e.preventDefault();
 navigate('/enterprise/coming-soon', { state: { path } });
 };

 React.useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
 e.preventDefault();
 setIsCommandOpen(prev => !prev);
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 return (
 <div className={styles.container}>
 <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
 <aside className={`${styles.sidebar} overflow-y-auto overflow-x-hidden custom-scrollbar`}>
 <div className={styles.brand}>
 <img src="/chatr-logo.png" alt="CHATR" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
 </div>

 <div className={styles.orgContext}>
 <div className={styles.orgAvatar}>A</div>
 <div className={styles.orgInfo}>
 <span className={styles.orgName}>Acme Healthcare</span>
 <span className={styles.orgEnv}>Production</span>
 </div>
 <ChevronDown size={14} className="text-slate-400" />
 </div>

 <div className={styles.navSection}>
 <div className={styles.navLabel}>Main</div>
 <nav className={styles.nav}>
 <Link 
 to="/enterprise" 
 className={`${styles.navItem} ${location.pathname === '/enterprise' ? styles.active : ''}`}
 >
 <Home /> Home
 </Link>
 <Link 
 to="/enterprise/marketplace" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/marketplace') ? styles.active : ''}`}
 >
 <Store /> Marketplace
 </Link>
 <Link 
 to="/enterprise/workspace" 
 className={`${styles.navItem} ${location.pathname === '/enterprise/workspace' ? styles.active : ''}`}
 >
 <Briefcase /> My Workspace
 </Link>
 <Link 
 to="/enterprise/runtime" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/runtime') ? styles.active : ''}`}
 >
 <Settings /> Capability Runtime
 </Link>
 <Link 
 to="/enterprise/executive" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/executive') ? styles.active : ''}`}
 >
 <BrainCircuit /> Executive AI
 </Link>
 </nav>
 </div>

 <div className={styles.navSection}>
 <div className={styles.navLabel}>Discover</div>
 <nav className={styles.nav}>
 <Link 
 to="/enterprise/search" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/search') ? styles.active : ''}`}
 >
 <Search /> Universal Search
 </Link>
 <Link 
 to="/enterprise/analytics" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/analytics') ? styles.active : ''}`}
 >
 <BarChart2 /> Analytics
 </Link>
 </nav>
 </div>

 <div className={styles.navSection}>
 <div className={styles.navLabel}>System</div>
 <nav className={styles.nav}>
 <Link 
 to="/enterprise/users" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/users') ? styles.active : ''}`}
 >
 <Users /> Users & Roles
 </Link>
 <Link 
 to="/enterprise/compliance" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/compliance') ? styles.active : ''}`}
 >
 <Shield /> Audit
 </Link>
 <Link 
 to="/enterprise/settings" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/settings') ? styles.active : ''}`}
 >
 <Settings /> Settings
 </Link>
 <Link 
 to="/enterprise/integrations" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/integrations') ? styles.active : ''}`}
 >
 <Cable /> Integrations
 </Link>
 <Link 
 to="/enterprise/developer" 
 className={`${styles.navItem} ${location.pathname.startsWith('/enterprise/developer') ? styles.active : ''}`}
 >
 <Hexagon /> Developer
 </Link>
 </nav>
 </div>

 <div className={styles.escapeHatch}>
 <Link to="/desktop/workspace-ide" className={styles.escapeItem}>
 <ArrowLeft size={18} />
 <span>
 Back to Workspace
 <small>Return to Workspace IDE</small>
 </span>
 </Link>
 </div>
 </aside>
 
 <main className={styles.main}>
 <Outlet />
 </main>
 </div>
 );
};
