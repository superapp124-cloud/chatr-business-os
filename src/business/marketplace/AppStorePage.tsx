import React, { useState, useEffect } from 'react';
import { Store, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface IntegrationApp {
  id: string;
  name: string;
  category: string;
  installed: boolean;
  icon: string;
  desc: string;
}

export default function AppStore() {
  const [apps, setApps] = useState<IntegrationApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApps() {
      try {
        const { data: dbConnectors } = await supabase
          .from('connectors')
          .select('*');

        if (dbConnectors && dbConnectors.length > 0) {
          setApps(
            dbConnectors.map((c: any) => ({
              id: c.id,
              name: c.name || c.display_name || 'App Connector',
              category: c.category || 'Integration',
              installed: c.status === 'connected',
              icon: c.icon || '🛍️',
              desc: c.description || 'Enterprise integration for CHATR Business OS.',
            }))
          );
        } else {
          setApps([
            { id: '1', name: 'Shopify Connector', category: 'E-commerce', installed: true, icon: '🛍️', desc: 'Sync orders, customers, and inventory in real-time.' },
            { id: '2', name: 'Zendesk Sync', category: 'Support', installed: false, icon: '🎧', desc: 'Create and update tickets directly from chats.' },
            { id: '3', name: 'Stripe Payments', category: 'Finance', installed: true, icon: '💳', desc: 'Accept payments and sync invoices automatically.' },
            { id: '4', name: 'Calendly Integration', category: 'Scheduling', installed: false, icon: '📅', desc: 'Let customers book meetings with your sales team.' },
          ]);
        }
      } catch (err) {
        console.warn('Failed to load apps:', err);
      } finally {
        setLoading(false);
      }
    }
    loadApps();
  }, []);

  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-gray-50 dark:bg-[#0B0F19] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-display text-gray-900 dark:text-white flex items-center gap-3">
              <Store className="h-8 w-8 text-primary" />
              App Store & Integrations
            </h1>
            <p className="text-gray-500 dark:text-white/60 mt-2">
              Extend CHATR Business with third-party apps and vertical-specific mini-apps.
            </p>
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps..."
            className="w-64 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredApps.map((app) => (
            <Card key={app.id} className="dark:bg-black/20 border-gray-200 dark:border-white/10 hover:shadow-lg transition-all group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="text-display">{app.icon}</div>
                  {app.installed && (
                    <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Installed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-section mt-4">{app.name}</CardTitle>
                <CardDescription className="text-label text-primary/80 ">{app.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-secondary text-gray-500 dark:text-white/60 mb-6 h-10 line-clamp-2">
                  {app.desc}
                </p>
                {app.installed ? (
                  <Button variant="outline" className="w-full border-gray-200 dark:border-white/10">Configure</Button>
                ) : (
                  <Button className="w-full bg-primary text-white hover:bg-primary/90">Install App</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
