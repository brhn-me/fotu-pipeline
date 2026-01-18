import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { OverviewPage } from './pages/OverviewPage';
import { SourcesPage } from './pages/SourcesPage';
import { FileExplorerPage } from './pages/FileExplorerPage';
import { WorkersPage } from './pages/WorkersPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/photos" element={<FileExplorerPage type="PHOTO" />} />
          <Route path="/videos" element={<FileExplorerPage type="VIDEO" />} />
          <Route path="/raw" element={<FileExplorerPage type="RAW" />} />
          <Route path="/unknown" element={<FileExplorerPage type="UNKNOWN" />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
