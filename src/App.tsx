import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { HostListView } from '@/features/host/HostListView';
import { BuilderView } from '@/features/builder/BuilderView';
import { HostDetailView } from '@/features/host/HostDetailView';
import { useHostStore } from '@/lib/store/useHostStore';
import { AppErrorToaster } from '@/components/layout/AppErrorToaster';

function App() {
  const { hosts, createHost, detectAndSetEnvironment, _hasHydrated } = useHostStore();

  useEffect(() => {
    if (!_hasHydrated) return;

    detectAndSetEnvironment();

    const init = async () => {
      if (hosts.length === 0) {
        await createHost('My Home Host');
      }
    };
    init();
  }, [hosts, createHost, detectAndSetEnvironment, _hasHydrated]);

  return (
    <div>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/hosts" replace />} />
          <Route path="/hosts" element={<HostListView />} />
          <Route path="/hosts/:hostId" element={<HostDetailView />} />
          <Route path="/hosts/:hostId/:composeId" element={<BuilderView />} />
        </Routes>
      </AppLayout>
      <AppErrorToaster />
    </div>
  );
}

export default App;
