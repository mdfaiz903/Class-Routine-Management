from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceViewSet, TeacherViewSet, UserViewSet, CourseViewSet, RoomViewSet,
    TimeSlotViewSet, RoutineRequirementViewSet, RoutineViewSet,
    RoutineChangeRequestViewSet, RoutineEnrollmentViewSet, register
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'teachers', TeacherViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'timeslots', TimeSlotViewSet)
router.register(r'routine-requirements', RoutineRequirementViewSet, basename='routine-requirements')
router.register(r'routines', RoutineViewSet)
router.register(r'enrollments', RoutineEnrollmentViewSet, basename='enrollments')
router.register(r'change-request', RoutineChangeRequestViewSet, basename='change-request')
router.register(r'attendance', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('register/', register, name='register'),
    path('', include(router.urls)),
]
