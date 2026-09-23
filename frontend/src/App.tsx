import {
  useState, useEffect, useCallback, useRef, useMemo, useContext
} from 'react';
import type { Ticket, Incident } from './types';
import { useAppContext } from './context/AppContext';
import { getCachedUser, clearCachedUser, type AuthUser } from './utils/auth';
import SubmissionForm from './components/SubmissionForm';
import HITLWorkspace from './components/HITLWorkspace';
import AdminOverview from './components/AdminOverview';
import AIWorkQueue from './components/AIWorkQueue';
import TicketsManager from './components/TicketsManager';
import IncidentsManager from './components/IncidentsManager';
import AnalyticsView from './components/AnalyticsView';
import KnowledgeHealthView from './components/KnowledgeHealthView';
import SettingsView from './components/SettingsView';
import CustomerDetailModal from './components/CustomerDetailModal';
import UserTicketsDashboard from './components/UserTicketsDashboard';
import LoadingSkeleton from './components/ui/LoadingSkeleton';
import AIStatusIndicator from './components/ui/AIStatusIndicator';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';

import {
  LayoutGrid, ClipboardList, ShieldCheck, Sun, Moon,
  UserCircle, BarChart2, BookOpen, Settings,
  Inbox, AlertOctagon, Search, Bell, X, Menu, Ticket as TicketIcon,
  LogOut
} from 'lucide-react';

type AdminSubTab = 'overview' | 'queue' | 'tickets' | 'incidents' | 'analytics' | 'knowledge' | 'settings';
type AuthMode = 'login' | 'signup';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'queue', label: 'AI Work Queue', icon: Inbox },
  { id: 'tickets', label: 'Tickets', icon: ClipboardList },
  { id: 'incidents', label: 'Incidents', icon: AlertOctagon },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'knowledge', label: 'Knowledge Health', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export default function App() {
  const {
    isMockMode,
    tickets,
    incidents,
    customers,
    knowledgeDocs,
    analytics,
    aiOverview,
    notifications,
    pendingCount,
    aiSystemStatus,
    loading,
    error,
    refreshAll,
    submitTicket,
    approveTicketAction,
    rejectTicketAction,
    markAllNotificationsRead,
  } = useAppContext();

  const [user, setUser] = useState<AuthUser | null>(() => getCachedUser());
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'submit' | 'dashboard' | 'hitl' | 'my-tickets'>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('overview');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const isDark = theme === 'dark';
  const isAdmin = user?.role === 'admin';

  // Auth guard — show login/signup if no cached user
  if (!user) {
    return authMode === 'login' ? (
      <LoginPage theme={theme} onLogin={(u) => { setUser(u); setTheme(u.role === 'admin' ? theme : theme); }} onSwitchToSignup={() => setAuthMode('signup')} />
    ) : (
      <SignupPage theme={theme} onSignup={(u) => { setUser(u); setAuthMode('login'); }} onSwitchToLogin={() => setAuthMode('login')} />
    );
  }

  const handleLogout = () => {
    clearCachedUser();
    setUser(null);
    setAuthMode('login');
  };

  const navigateAdminTab = useCallback((tab: AdminSubTab) => {
    setPageLoading(true);
    setAdminSubTab(tab);
    setSidebarOpen(false);
    setShowNotifications(false);
    setTimeout(() => setPageLoading(false), 350);
  }, []);

  const unreadNotificationsCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const handleNewTicket = async (newTicketData: { subject: string; description: string; imageUrl?: string }) => {
    await submitTicket(newTicketData);
    setActiveTab('my-tickets');
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setActiveTab('hitl');
    setSidebarOpen(false);
  };

  const handleApproveTicket = async (id: string, finalDept: Ticket['department'], finalSolution: string) => {
    const ticket = tickets.find(t => t.id === id);
    await approveTicketAction({ id, department: finalDept, solution: finalSolution, threadId: ticket?.threadId });
    setActiveTab('dashboard');
    setSelectedTicket(null);
  };

  const handleRejectTicket = async (id: string) => {
    const ticket = tickets.find(t => t.id === id);
    await rejectTicketAction(id, ticket?.threadId);
    setActiveTab('dashboard');
    setSelectedTicket(null);
  };

  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return null;
    const query = globalSearch.toLowerCase();
    const matchedTickets = tickets.filter(t => t.subject.toLowerCase().includes(query) || t.id.toLowerCase().includes(query));
    const matchedIncidents = incidents.filter(i => i.title.toLowerCase().includes(query) || i.id.toLowerCase().includes(query));
    const matchedCustomers = customers.filter(c => c.name.toLowerCase().includes(query));
    const matchedJira = tickets.filter(t => t.jiraEscalation?.issueKey.toLowerCase().includes(query));
    const matchedDocs = knowledgeDocs.filter(d => d.title.toLowerCase().includes(query) || d.id.toLowerCase().includes(query));
    return { tickets: matchedTickets, incidents: matchedIncidents, customers: matchedCustomers, docs: matchedDocs, jira: matchedJira };
  }, [globalSearch, tickets, incidents, customers, knowledgeDocs]);

  const markNotificationsRead = () => { void markAllNotificationsRead(); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isAdmin) searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setGlobalSearch('');
        setShowNotifications(false);
        setSelectedIncident(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  const adminName = user?.name || 'Administrator';
  const firstName = adminName.split(' ')[0];

  const renderAdminContent = () => {
    if (pageLoading) return <LoadingSkeleton message="Preparing operational view..." />;
    switch (adminSubTab) {
      case 'overview':
        return (
          <AdminOverview
            tickets={tickets}
            incidents={incidents}
            aiOverview={aiOverview}
            onSelectTicket={handleSelectTicket}
            onNavigateTab={(tab) => navigateAdminTab(tab as AdminSubTab)}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            theme={theme}
            onOpenCustomer={(name) => setSelectedCustomerName(name)}
            adminName={firstName}
          />
        );
      case 'queue':
        return <AIWorkQueue tickets={tickets} onSelectTicket={handleSelectTicket} onApprove={handleApproveTicket} onReject={handleRejectTicket} theme={theme} onOpenCustomer={(name) => setSelectedCustomerName(name)} />;
      case 'tickets':
        return <TicketsManager tickets={tickets} onSelectTicket={handleSelectTicket} theme={theme} onOpenCustomer={(name) => setSelectedCustomerName(name)} />;
      case 'incidents':
        return <IncidentsManager tickets={tickets} incidents={incidents} onSelectTicket={handleSelectTicket} theme={theme} />;
      case 'analytics':
        return <AnalyticsView theme={theme} analytics={analytics} knowledgeDocs={knowledgeDocs} tickets={tickets} />;
      case 'knowledge':
        return <KnowledgeHealthView theme={theme} knowledgeDocs={knowledgeDocs} />;
      case 'settings':
        return <SettingsView theme={theme} />;
      default:
        return null;
    }
  };

  const notificationsPanel = (
    <div className="relative">
      <button
        onClick={() => { setShowNotifications(!showNotifications); markNotificationsRead(); }}
        className={`p-3 rounded-xl border transition-all cursor-pointer relative ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white' : 'bg-white border-slate-200 text-zinc-600 hover:bg-gray-50'
          }`}
      >
        <Bell size={18} />
        {unreadNotificationsCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
        )}
      </button>
      {showNotifications && (
        <div className={`absolute right-0 mt-2 w-80 rounded-xl border p-4 shadow-2xl z-50 space-y-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
          <div className="flex justify-between items-center border-b pb-2 border-zinc-800">
            <span className="text-xs font-bold">System Notifications</span>
            <button onClick={() => setShowNotifications(false)} className="text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {notifications.map(n => (
              <div key={n.id} className={`p-2.5 rounded-lg text-xs leading-normal ${!n.read ? isDark ? 'bg-indigo-950/20 text-indigo-200' : 'bg-indigo-50/50 text-indigo-900' : 'bg-transparent'
                }`}>
                <div className="flex justify-between font-semibold">
                  <span>{n.title}</span>
                  <span className="text-[9px] text-zinc-500 font-mono">{n.time}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const searchBar = (
    <div className="relative w-full">
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} size={20} />
        <input
          ref={searchInputRef}
          type="text"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Global search (Ctrl+K)..."
          className={`w-full border rounded-2xl pl-12 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg transition-all ${isDark ? 'bg-zinc-900/80 border-zinc-800 text-white placeholder-zinc-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-slate-200'
            }`}
        />
        {globalSearch && (
          <button onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        )}
      </div>
      {searchResults && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border p-4 max-h-80 overflow-y-auto space-y-3.5 shadow-2xl z-50 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
          {searchResults.tickets.length === 0 && searchResults.incidents.length === 0 && searchResults.customers.length === 0 && searchResults.docs.length === 0 && searchResults.jira.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-2">No matching records found.</p>
          )}
          {searchResults.tickets.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block">Tickets</span>
              {searchResults.tickets.slice(0, 3).map(t => (
                <div key={t.id} onClick={() => { handleSelectTicket(t); setGlobalSearch(''); }} className={`p-2 rounded-lg text-xs cursor-pointer ${isDark ? 'hover:bg-zinc-900' : 'hover:bg-gray-50'}`}>
                  <strong className="text-indigo-400 font-mono pr-1.5">{t.id}</strong> {t.subject}
                </div>
              ))}
            </div>
          )}
          {searchResults.incidents.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block">Incidents</span>
              {searchResults.incidents.map(inc => (
                <div key={inc.id} onClick={() => { setSelectedIncident(inc); setGlobalSearch(''); }} className={`p-2 rounded-lg text-xs cursor-pointer ${isDark ? 'hover:bg-zinc-900' : 'hover:bg-gray-50'}`}>
                  <strong className="text-rose-500 font-mono pr-1.5">{inc.id}</strong> {inc.title}
                </div>
              ))}
            </div>
          )}
          {searchResults.customers.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block">Customers</span>
              {searchResults.customers.map(c => (
                <div key={c.id} onClick={() => { setSelectedCustomerName(c.name); setGlobalSearch(''); }} className={`p-2 rounded-lg text-xs cursor-pointer ${isDark ? 'hover:bg-zinc-900' : 'hover:bg-gray-50'}`}>{c.name} ({c.tier})</div>
              ))}
            </div>
          )}
          {searchResults.docs.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block">Knowledge Docs</span>
              {searchResults.docs.slice(0, 3).map(d => <div key={d.id} className={`p-2 rounded-lg text-xs ${isDark ? 'hover:bg-zinc-900' : 'hover:bg-gray-50'}`}><strong className="text-indigo-400 font-mono pr-1.5">{d.id}</strong> {d.title}</div>)}
            </div>
          )}
          {searchResults.jira.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block">Jira References</span>
              {searchResults.jira.map(t => (
                <div key={t.id} onClick={() => { handleSelectTicket(t); setGlobalSearch(''); }} className={`p-2 rounded-lg text-xs cursor-pointer ${isDark ? 'hover:bg-zinc-900' : 'hover:bg-gray-50'}`}>
                  <strong className="text-rose-500 font-mono pr-1.5">{t.jiraEscalation?.issueKey}</strong> {t.subject}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const navItems = isAdmin
    ? NAV_ITEMS.map(it => ({ ...it, badge: it.id === 'queue' ? pendingCount : undefined }))
    : [
      { id: 'submit', label: 'Submit Ticket', icon: ClipboardList },
      { id: 'my-tickets', label: 'My Tickets', icon: TicketIcon },
    ];

  const currentTabForNav = isAdmin ? adminSubTab : activeTab;

  const sidebar = (
    <aside className={`fixed md:sticky md:top-0 md:h-screen inset-y-0 right-0 z-50 md:z-30 w-64 md:w-52 flex flex-col transition-transform duration-300 md:translate-x-0 rounded-l-md md:rounded-none border-l ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isDark ? 'bg-zinc-950/98 md:bg-zinc-950/60 border-zinc-800' : 'bg-white md:bg-gray-100/80 border-slate-200'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 md:hidden border-b ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Menu</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className={`p-2 rounded-lg border transition-colors ${isDark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-400' : 'border-slate-200 hover:bg-gray-100 text-slate-600'
            }`}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav items — top */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto pt-4 md:pt-4">
        {navItems.map((item: any) => {
          const Icon = item.icon;
          const isActive = currentTabForNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (isAdmin) navigateAdminTab(item.id as AdminSubTab);
                else setActiveTab(item.id as 'submit' | 'my-tickets');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${isActive
                  ? isDark
                    ? 'bg-gray-200 text-zinc-900 shadow-sm'
                    : 'bg-gray-200 text-zinc-900 shadow-sm'
                  : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile: theme + portal controls at bottom */}
      <div className={`p-4 space-y-3 md:hidden border-t ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold ${isDark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-gray-100'
              }`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={handleLogout}
            className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold ${isDark ? 'border-zinc-800 text-rose-400 hover:bg-rose-500/5' : 'border-slate-200 text-rose-600 hover:bg-rose-50'
              }`}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 relative ${isDark ? 'bg-zinc-950 text-zinc-100 bg-grid-pattern dark-theme' : 'bg-gray-100 text-slate-800 bg-grid-pattern-light light-theme'
      }`}>
      {/* Background radial glow */}
      <div className={`absolute inset-0 pointer-events-none z-0 ${isDark ? 'gradient-glow' : 'gradient-glow-light'}`}></div>

      {/* Global Header */}
      <header className={`sticky top-0 z-40 w-full px-4 md:px-6 py-3 flex items-center justify-between gap-4 border-b ${isDark ? 'bg-slate-900/95 backdrop-blur-md border-zinc-800' : 'bg-gray-200/95 backdrop-blur-md border-slate-200'
        }`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 z-10">
          <div className={`p-2.5 rounded-xl shadow-lg flex items-center justify-center text-white ${isDark ? 'bg-indigo-700 shadow-indigo-700/30' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              ChurnDesk
            </span>
            <h1 className={`text-base font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isAdmin ? 'Admin Operations Control' : 'Submitter Portal'}
            </h1>
            {isMockMode && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                Demo Mode
              </span>
            )}
          </div>
        </div>

        {/* Desktop: search center */}
        {isAdmin && (
          <div className="hidden lg:flex flex-1 justify-center px-8">
            <div className="w-full max-w-xl">{searchBar}</div>
          </div>
        )}

        {/* Desktop actions */}
        <div className="hidden lg:flex items-center gap-3 z-10">
          {isAdmin && <AIStatusIndicator status={aiSystemStatus} compact />}
          {isAdmin && notificationsPanel}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${isDark ? 'bg-zinc-900 border-zinc-800 text-amber-400 hover:text-amber-300' : 'bg-white border-slate-200 text-zinc-600 hover:bg-gray-50'
              }`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
            <UserCircle size={18} className="text-indigo-400" />
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{firstName}</span>
            <button onClick={handleLogout} className={`text-zinc-500 hover:text-rose-500 transition-colors`} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Mobile: menu + theme buttons (search + notifications in sticky row below) */}
        <div className="lg:hidden flex items-center gap-2 z-10">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${isDark ? 'bg-zinc-900 border-zinc-800 text-amber-400' : 'bg-white border-slate-200 text-zinc-600'}`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            className={`p-3 rounded-xl shadow-lg border text-white ${isDark ? 'bg-indigo-700 border-indigo-600' : 'bg-indigo-600 border-indigo-500'}`}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Mobile: search bar under header (admin only) */}
      {isAdmin && (
        <div className={`lg:hidden sticky top-[64px] z-30 px-4 py-2 border-b backdrop-blur-md flex items-center gap-2 ${isDark ? 'bg-zinc-950/95 border-zinc-800' : 'bg-white/95 border-slate-200'
          }`}>
          <div className="flex-1">{searchBar}</div>
          {notificationsPanel}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row relative z-10">
        {sidebar}

        {/* Content Pane */}
        <main className="flex-grow max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 lg:py-8 relative overflow-x-hidden">
          {error && (
            <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm flex items-center justify-between gap-4">
              <span>Unable to load data: {error}</span>
              <button onClick={() => refreshAll()} className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold">Retry</button>
            </div>
          )}

          {loading && tickets.length === 0 ? (
            <LoadingSkeleton message="Loading operational data..." />
          ) : (
            <>
              {activeTab === 'submit' && !isAdmin && <SubmissionForm onSubmitSuccess={handleNewTicket} theme={theme} />}
              {activeTab === 'my-tickets' && !isAdmin && <UserTicketsDashboard tickets={tickets} theme={theme} />}
              {isAdmin && activeTab === 'dashboard' && renderAdminContent()}
              {activeTab === 'hitl' && selectedTicket && (
                <HITLWorkspace
                  ticket={selectedTicket}
                  onBack={() => { setActiveTab('dashboard'); setSelectedTicket(null); }}
                  onApprove={handleApproveTicket}
                  onReject={handleRejectTicket}
                  theme={theme}
                  onOpenCustomer={(name) => setSelectedCustomerName(name)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {selectedCustomerName && (
        <CustomerDetailModal
          customerName={selectedCustomerName}
          onClose={() => setSelectedCustomerName(null)}
          theme={theme}
          onSelectTicketId={(id) => { const ticket = tickets.find(t => t.id === id); if (ticket) { setSelectedCustomerName(null); handleSelectTicket(ticket); } }}
        />
      )}

      {selectedIncident && (
        <IncidentsManager
          tickets={tickets}
          incidents={incidents}
          externalIncident={selectedIncident}
          onCloseExternalIncident={() => setSelectedIncident(null)}
          onSelectTicket={(t) => { setSelectedIncident(null); handleSelectTicket(t); }}
          theme={theme}
        />
      )}

      {/* Footer */}
      <footer className={`w-full text-center py-3 border-t text-sm font-mono z-10 mt-auto ${isDark ? 'border-zinc-800 bg-zinc-950/60 text-zinc-500' : 'border-slate-200 bg-gray-200 text-slate-600'
        }`}>
        <span className="font-bold text-indigo-500">churnDesk</span> &copy; {new Date().getFullYear()} &bull; Intelligent Incident Routing & AI Operations
      </footer>
    </div>
  );
}