from django.contrib import admin
from .models import (
    Attendance, AttendanceAction, Teacher, Course, Room, TimeSlot, Routine,
    RoutineChangeRequest, RoutineEnrollment, RoutineRequirement
)


# -------------------------
# TEACHER ADMIN (IMPROVED)
# -------------------------
@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'email']
    readonly_fields = ['name', 'email']

    def save_model(self, request, obj, form, change):
        # auto sync from User model
        obj.name = obj.user.first_name
        obj.email = obj.user.email
        super().save_model(request, obj, form, change)


# -------------------------
# OTHER MODELS (UNCHANGED BUT CLEAN STYLE)
# -------------------------
@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'code']


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'room_type']
    list_filter = ['room_type']


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ['label', 'start_time', 'end_time', 'order']
    ordering = ['order', 'start_time']


@admin.register(RoutineRequirement)
class RoutineRequirementAdmin(admin.ModelAdmin):
    list_display = ['course', 'teacher', 'section', 'sessions_per_week', 'required_room_type']
    list_filter = ['required_room_type']


@admin.register(Routine)
class RoutineAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'course', 'day', 'section', 'time_slot', 'room_ref']
    list_filter = ['day', 'room_ref']


@admin.register(RoutineEnrollment)
class RoutineEnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'routine', 'enrolled_at']
    list_filter = ['routine__day', 'routine__course']
    search_fields = ['student__username', 'student__first_name', 'student__email']


@admin.register(RoutineChangeRequest)
class RoutineChangeRequestAdmin(admin.ModelAdmin):
    list_display = ['routine', 'requested_by', 'status', 'requested_at']
    list_filter = ['status', 'requested_at']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'routine', 'date', 'check_in_time', 'check_out_time']
    list_filter = ['date', 'month', 'year', 'teacher']


@admin.register(AttendanceAction)
class AttendanceActionAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'action_type', 'date', 'time', 'attendance']
    list_filter = ['action_type', 'date', 'month', 'year', 'teacher']
