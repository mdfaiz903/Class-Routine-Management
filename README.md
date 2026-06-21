# Class Routine Management System

A comprehensive full-stack **Smart Class Management System (SCMS)** built with Django REST Framework and React. This system enables efficient management of class routines, course assignments, student enrollment, and teacher attendance tracking with role-based access control.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

The Class Routine Management System is a web application designed to streamline class management operations in educational institutions. It provides a centralized platform for managing:

- **Routines**: Create and manage class schedules
- **Courses**: Assign courses to classes and manage course details
- **Teachers**: Manage teacher information and assignments
- **Students**: Handle student enrollment and tracking
- **Attendance**: Track teacher attendance with check-in/check-out functionality
- **Change Requests**: Manage and approve routine change requests

The system supports three user roles:
- **Admin**: Full system access and management
- **Teachers**: View assigned courses, manage attendance, request routine changes
- **Students**: View enrolled courses and class routines

## Features

### Core Features

✅ **Role-Based Access Control (RBAC)**
- Admin dashboard with full system management
- Teacher portal for course and attendance management
- Student dashboard for viewing routines and enrolled courses

✅ **Routine Management**
- Create, update, and delete class routines
- View detailed routine information
- Request and manage routine changes

✅ **Course & Teacher Management**
- Assign courses to classes
- Manage teacher assignments
- Track teacher information and qualifications

✅ **Student Enrollment**
- Manage student enrollment in courses
- Track enrollment status and history
- View enrolled courses

✅ **Attendance Tracking**
- Check-in/check-out functionality for teachers
- Attendance summaries and reports
- Track daily attendance records

✅ **Change Requests**
- Submit routine change requests
- Approve/reject change requests
- Track change request status

✅ **Authentication & Security**
- JWT-based authentication
- Secure password handling
- Protected API endpoints

## Tech Stack

### Backend
- **Framework**: Django 3.2+
- **API**: Django REST Framework
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT Token Authentication
- **Python**: 3.8+

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **HTTP Client**: Axios
- **Styling**: CSS
- **Authentication**: Context API with JWT tokens
- **Node.js**: 16+

## Project Structure

```
Class-Routine-Management/
├── backend/                          # Django Backend
│   ├── config/                       # Project configuration
│   │   ├── settings.py              # Django settings
│   │   ├── urls.py                  # URL routing
│   │   ├── asgi.py                  # ASGI configuration
│   │   └── wsgi.py                  # WSGI configuration
│   ├── routine/                      # Main app
│   │   ├── models.py                # Database models
│   │   ├── views.py                 # API views
│   │   ├── serializers.py           # DRF serializers
│   │   ├── urls.py                  # App URL routing
│   │   ├── permissions.py           # Custom permissions
│   │   ├── admin.py                 # Django admin configuration
│   │   ├── apps.py                  # App configuration
│   │   ├── migrations/              # Database migrations
│   │   └── tests.py                 # Unit tests
│   ├── manage.py                    # Django management script
│   └── requirements.txt             # Python dependencies
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── pages/                   # Page components
│   │   │   ├── Dashboard.jsx       # Main dashboard
│   │   │   ├── Login.jsx           # Login page
│   │   │   ├── Signup.jsx          # Registration page
│   │   │   ├── Routines.jsx        # Routines page
│   │   │   ├── Courses.jsx         # Courses page
│   │   │   ├── Teachers.jsx        # Teachers page
│   │   │   └── ChangeRequests.jsx  # Change requests page
│   │   ├── components/              # Reusable components
│   │   │   ├── Layout.jsx          # Main layout wrapper
│   │   │   ├── Modal.jsx           # Modal component
│   │   │   └── PrivateRoute.jsx    # Protected route component
│   │   ├── context/                 # React context
│   │   │   ├── AuthContext.jsx     # Authentication context
│   │   │   ├── AuthContextValue.js # Auth context value definitions
│   │   │   └── useAuth.js          # Custom auth hook
│   │   ├── api/                     # API utilities
│   │   │   └── axios.js            # Axios instance configuration
│   │   ├── App.jsx                  # Root component
│   │   ├── main.jsx                 # Entry point
│   │   ├── App.css                  # Global styles
│   │   └── index.css                # Base styles
│   ├── public/                       # Static assets
│   ├── package.json                 # Node dependencies
│   ├── vite.config.js              # Vite configuration
│   ├── eslint.config.js            # ESLint configuration
│   ├── index.html                   # HTML template
│   └── README.md                    # Frontend documentation
│
└── README.md                         # Project documentation
```

## Installation

### Prerequisites

Before you begin, ensure you have the following installed:
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn
- Git

### Backend Setup

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run database migrations**
   ```bash
   python manage.py migrate
   ```

6. **Create a superuser (admin account)**
   ```bash
   python manage.py createsuperuser
   ```

### Frontend Setup

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**
   ```bash
   npm install
   ```


## Running the Project

### Starting the Backend Server

1. **From the backend directory** (with virtual environment activated):
   ```bash
   python manage.py runserver
   ```
   
   The backend will run on `http://localhost:8000`

### Starting the Frontend Development Server

1. **From the frontend directory**:
   ```bash
   npm run dev
   ```
   
   The frontend will run on `http://localhost:5173`

### Accessing the Application

- **Frontend**: Navigate to `http://localhost:5173`
- **Backend Admin**: Navigate to `http://localhost:8000/admin`
- **API Documentation**: Navigate to `http://localhost:8000/api` (if DRF browsable API is enabled)

## API Documentation

### Authentication Endpoints

**Login**
```
POST /api/auth/login/
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}

Response:
{
  "access": "token...",
  "refresh": "token...",
  "user": {...}
}
```

**Signup**
```
POST /api/auth/signup/
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "student" | "teacher" | "admin"
}
```

### Routine Endpoints

**List Routines**
```
GET /api/routines/
Authorization: Bearer <access_token>
```

**Create Routine**
```
POST /api/routines/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "class_name": "Class A",
  "day": "Monday",
  "start_time": "09:00:00",
  "end_time": "10:00:00",
  "teacher_id": 1,
  "course_id": 1
}
```

### Attendance Endpoints

**Check-in**
```
POST /api/attendance/checkin/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "teacher_id": 1,
  "check_in_time": "2024-06-21T09:00:00Z"
}
```

**Check-out**
```
POST /api/attendance/checkout/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "teacher_id": 1,
  "check_out_time": "2024-06-21T17:00:00Z"
}
```

For complete API documentation, refer to the Django REST Framework browsable API at `http://localhost:8000/api`

## Development Guidelines

### Code Style

- **Backend**: Follow PEP 8 guidelines
- **Frontend**: Follow ESLint configuration in `eslint.config.js`

### Running Tests

**Backend**
```bash
cd backend
python manage.py test
```

**Frontend**
```bash
cd frontend
npm run test
```

### Building for Production

**Frontend**
```bash
cd frontend
npm run build
```

The built files will be in the `dist/` directory.

## Troubleshooting

### Common Issues

**Backend won't start**
- Ensure virtual environment is activated
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check that port 8000 is not in use

**Frontend won't start**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Ensure Node.js version is 16 or higher: `node --version`
- Check that port 5173 is not in use

**Authentication issues**
- Verify the backend and frontend are running on the correct ports
- Check that JWT tokens are being stored in localStorage
- Ensure API_URL is correctly configured in `.env`

**Database errors**
- Run migrations: `python manage.py migrate`
- Check database file permissions
- Clear migrations and recreate if necessary

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Review Process

- All PRs require at least one code review
- Tests must pass before merging
- Follow the existing code style and conventions



## Support

For support, issues, or questions:
- Open an issue on the repository
- Contact the development team
- Check existing issues for solutions

