import { Route, Routes } from 'react-router-dom';
import SubmissionPage from './pages/SubmissionPage.jsx';
import WallPage from './pages/WallPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

function App() {
  return (
    <div className="app-shell app-shell--immersive">
      <main className="app-main app-main--immersive">
        <Routes>
          <Route path="/" element={<SubmissionPage />} />
          <Route path="/wall" element={<WallPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
