import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search
} from 'lucide-react';
import { useHostStore } from '@/lib/store/useHostStore';
import { uniqueComposeName } from '@/lib/core/bundle-utils';
import { BundleLauncher } from './components/BundleLauncher';
import { HostCard } from './components/HostCard';

import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function HostListView() {
  const { hosts, createHost, createCompose } = useHostStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isBundleLauncherOpen, setIsBundleLauncherOpen] = useState(false);
  const [bundleHostId, setBundleHostId] = useState<string | undefined>(undefined);
  const [newHostOpen, setNewHostOpen] = useState(false);
  const [newHostName, setNewHostName] = useState('');
  const [newComposeHostId, setNewComposeHostId] = useState<string | null>(null);
  const [newComposeName, setNewComposeName] = useState('');

  const filteredHosts = hosts.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const submitNewHost = () => {
    const name = newHostName.trim();
    if (!name) return;
    createHost(name);
    setNewHostName('');
    setNewHostOpen(false);
  };

  const submitNewCompose = async () => {
    const baseName = newComposeName.trim();
    if (!baseName || !newComposeHostId) return;
    const host = hosts.find((h) => h.id === newComposeHostId);
    const name = uniqueComposeName(host?.stacks.map((s) => s.name) ?? [], baseName);
    const composeId = await createCompose(newComposeHostId, name);
    navigate(`/hosts/${newComposeHostId}/${composeId}`);
    setNewComposeName('');
    setNewComposeHostId(null);
  };

  return (
    <>
    <div className="flex-1 overflow-auto bg-background p-8 scrollbar-thin">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/50 pb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-foreground">Hosts</h2>
            <p className="text-sm text-muted-foreground font-medium max-w-lg">
              Manage your self-hosted environments. Switch between cloud clusters, local development boxes, or home lab deployments.
            </p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              type="text" 
              placeholder="Filter environments..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add New Card */}
          <Card 
            onClick={() => setNewHostOpen(true)}
            className="group cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all bg-transparent shadow-none"
          >
             <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-all group-hover:scale-110 mb-4 shadow-sm">
                <Plus size={24} />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">Create New Host</span>
          </Card>

          {filteredHosts.map(host => (
            <HostCard 
              key={host.id}
              host={host}
              onAddCompose={(id) => {
                setNewComposeHostId(id);
                setNewComposeName('');
              }}
              onOpenBundle={(id) => {
                setBundleHostId(id);
                setIsBundleLauncherOpen(true);
              }}
            />
          ))}
        </div>
      </div>
    </div>
    <BundleLauncher 
       open={isBundleLauncherOpen} 
       onOpenChange={setIsBundleLauncherOpen}
       mode="new-compose"
       hostId={bundleHostId}
    />
    <AlertDialog open={newHostOpen} onOpenChange={(open) => { setNewHostOpen(open); if (!open) setNewHostName(''); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create host</AlertDialogTitle>
          <AlertDialogDescription>Name the machine or environment you want to organize compose projects under.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={newHostName}
          onChange={(event) => setNewHostName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submitNewHost()}
          placeholder="homelab"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!newHostName.trim()} onClick={submitNewHost}>Create</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!newComposeHostId} onOpenChange={(open) => { if (!open) { setNewComposeHostId(null); setNewComposeName(''); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create compose</AlertDialogTitle>
          <AlertDialogDescription>Give this compose project a short, recognizable name.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={newComposeName}
          onChange={(event) => setNewComposeName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submitNewCompose()}
          placeholder="media-stack"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!newComposeName.trim()} onClick={submitNewCompose}>Create</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
