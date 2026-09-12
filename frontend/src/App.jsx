import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Courses from './pages/Courses';
import Rooms from './pages/Rooms';
import TimeSlots from './pages/TimeSlots';
import RoutineRequirements from './pages/RoutineRequirements';
import GenerateRoutine from './pages/GenerateRoutine';
import Routines from './pages/Routines';
import ChangeRequests from './pages/ChangeRequests';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="courses" element={<Courses />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="timeslots" element={<TimeSlots />} />
            <Route path="routine-requirements" element={<RoutineRequirements />} />
            <Route path="generate-routine" element={<GenerateRoutine />} />
            <Route path="routines" element={<Routines />} />
            <Route path="change-requests" element={<ChangeRequests />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
