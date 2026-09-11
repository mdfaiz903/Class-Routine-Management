from calendar import monthrange
from datetime import date

from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from . import scheduling
from .exporters import export_routines_excel, export_routines_pdf
from .models import (
    Attendance, AttendanceAction, Room, Teacher, Course, Routine,
    RoutineChangeRequest, RoutineEnrollment, RoutineRequirement, TimeSlot
)
from .serializers import (
    AttendanceSerializer, TeacherSerializer, CourseSerializer, RoomSerializer,
    RoutineSerializer, RoutineChangeRequestSerializer, RoutineEnrollmentSerializer,
    RoutineRequirementSerializer, TimeSlotSerializer,
    RegisterSerializer, UserSerializer
)
from .permissions import IsAdminUser


# -------------------------
# REGISTER (ONLY USER)
# -------------------------
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.first_name,
            # Review: signup creates a normal account; admin can promote it to Teacher later.
            "role": "Student"
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------
# TEACHER (ADMIN ONLY ROLE ASSIGNMENT)
# -------------------------
class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAdminUser]


# -------------------------
# USERS (ADMIN SELECTS WHO BECOMES TEACHER)
# -------------------------
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        # Review: expose all users to admin; frontend filters eligible teacher choices.
        return User.objects.all().order_by('username')


# -------------------------
# ROUTINE ENROLLMENT (ADMIN ASSIGNS STUDENTS)
# -------------------------
class RoutineEnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineEnrollmentSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        queryset = RoutineEnrollment.objects.select_related(
            'student', 'routine', 'routine__course', 'routine__teacher'
        )
        routine_id = self.request.query_params.get('routine')
        student_id = self.request.query_params.get('student')

        if routine_id:
            queryset = queryset.filter(routine_id=routine_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        return queryset


# -------------------------
# COURSE
# -------------------------
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]


# -------------------------
# ROOM
# -------------------------
class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all().order_by('name')
    serializer_class = RoomSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]


# -------------------------
# TIME SLOT
# -------------------------
class TimeSlotViewSet(viewsets.ModelViewSet):
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]


# -------------------------
# ROUTINE REQUIREMENT (GENERATOR INPUT)
# -------------------------
class RoutineRequirementViewSet(viewsets.ModelViewSet):
    queryset = RoutineRequirement.objects.select_related('course', 'teacher').all()
    serializer_class = RoutineRequirementSerializer
    permission_classes = [IsAdminUser]


# -------------------------
# ROUTINE
# -------------------------
class RoutineViewSet(viewsets.ModelViewSet):
    queryset = Routine.objects.all()
    serializer_class = RoutineSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'generate', 'generate_commit', 'import_excel']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = Routine.objects.select_related(
            'teacher', 'course', 'room_ref', 'time_slot'
        ).prefetch_related(
            'enrollments', 'enrollments__student'
        )
        user = self.request.user

        if user.is_superuser:
            return queryset

        if hasattr(user, 'teacher'):
            return queryset.filter(teacher=user.teacher)

        return queryset.filter(enrollments__student=user).distinct()

    @action(detail=False, methods=['get'], url_path='my-routines')
    def my_routines(self, request):
        user = request.user

        if not hasattr(user, 'teacher'):
            return Response(
                {"detail": "Only teachers can access routines."},
                status=status.HTTP_403_FORBIDDEN
            )

        routines = self.get_queryset()
        serializer = self.get_serializer(routines, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        requirement_ids = request.data.get('requirement_ids')
        preview = scheduling.generate_preview(requirement_ids=requirement_ids)
        return Response(preview)

    @action(detail=False, methods=['post'], url_path='generate/commit')
    def generate_commit(self, request):
        rows = request.data.get('rows', [])
        created = []
        rejected = []

        with transaction.atomic():
            for row in rows:
                try:
                    teacher = Teacher.objects.filter(id=row.get('teacher_id')).first() if row.get('teacher_id') else None
                    course = Course.objects.get(id=row['course_id'])
                    room = Room.objects.get(id=row['room_id'])
                    time_slot = TimeSlot.objects.get(id=row['time_slot_id'])
                    day = row['day']
                    section = row.get('section', '')

                    scheduling.assert_no_conflicts(day, time_slot, teacher, room, section)

                    routine = Routine.objects.create(
                        teacher=teacher,
                        course=course,
                        day=day,
                        section=section,
                        room_ref=room,
                        time_slot=time_slot,
                        start_time=time_slot.start_time,
                        end_time=time_slot.end_time,
                        room=room.name,
                    )
                    created.append(RoutineSerializer(routine).data)
                except (scheduling.ConflictError, Course.DoesNotExist, Room.DoesNotExist, TimeSlot.DoesNotExist, KeyError) as exc:
                    rejected.append({'row': row, 'reason': str(exc)})

        return Response({'created': created, 'rejected': rejected})

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        # Note: named 'type', not 'format' - DRF reserves the 'format' query
        # param for its own content-negotiation and 404s if it doesn't match
        # a registered renderer (e.g. JSON/browsable API), which 'pdf'/'excel' never would.
        export_type = request.query_params.get('type')
        routines = self.get_queryset()

        if export_type == 'pdf':
            content = export_routines_pdf(routines)
            response = HttpResponse(content, content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="routine.pdf"'
            return response

        if export_type == 'excel':
            content = export_routines_excel(routines)
            response = HttpResponse(
                content,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            response['Content-Disposition'] = 'attachment; filename="routine.xlsx"'
            return response

        return Response(
            {"detail": "Query parameter 'type' must be 'pdf' or 'excel'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['post'], url_path='import-excel', parser_classes=[MultiPartParser])
    def import_excel(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workbook = load_workbook(upload, data_only=True)
        except Exception:
            return Response({"detail": "Could not read the uploaded file as an Excel workbook."}, status=status.HTTP_400_BAD_REQUEST)

        report = scheduling.import_routines_from_workbook(workbook)
        return Response(report)


# -------------------------
# ROUTINE CHANGE REQUEST
# -------------------------
class RoutineChangeRequestViewSet(viewsets.ModelViewSet):
    queryset = RoutineChangeRequest.objects.all()
    serializer_class = RoutineChangeRequestSerializer

    def get_permissions(self):
        # Review: admins manage all requests; teachers can create/list their own.
        if self.action in ['create', 'list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(user, 'teacher'):
            raise PermissionDenied("Only teachers can create requests.")

        serializer.save(requested_by=user.teacher)

    def get_queryset(self):
        user = self.request.user

        if user.is_superuser:
            return RoutineChangeRequest.objects.all()

        if hasattr(user, 'teacher'):
            return RoutineChangeRequest.objects.filter(requested_by=user.teacher)

        return RoutineChangeRequest.objects.none()


def _is_routine_active_now(routine, current_datetime):
    return (
        routine.day == current_datetime.strftime('%A') and
        routine.start_time <= current_datetime.time() <= routine.end_time
    )


def _positive_int(value, field_name, minimum=None, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise PermissionDenied(f"{field_name} must be a number.")

    if minimum is not None and number < minimum:
        raise PermissionDenied(f"{field_name} must be at least {minimum}.")
    if maximum is not None and number > maximum:
        raise PermissionDenied(f"{field_name} must be at most {maximum}.")
    return number


def _scheduled_slots_for_teacher(teacher, year, month, day=None):
    last_day = monthrange(year, month)[1]
    days = [day] if day else range(1, last_day + 1)
    routines = Routine.objects.filter(teacher=teacher).select_related('course', 'teacher')
    slots = []

    for day_number in days:
        slot_date = date(year, month, day_number)
        weekday_name = slot_date.strftime('%A')
        for routine in routines.filter(day=weekday_name):
            slots.append((slot_date, routine))

    return slots


def _attendance_summary_for_teacher(teacher, year, month, day=None):
    today = timezone.localdate()
    slots = []
    present_dates = set()
    absent_dates = set()

    for slot_date, routine in _scheduled_slots_for_teacher(teacher, year, month, day):
        if slot_date > today:
            continue

        attendance = Attendance.objects.filter(
            teacher=teacher,
            routine=routine,
            date=slot_date,
        ).first()
        is_present = bool(attendance and attendance.check_in_time and attendance.check_out_time)

        if is_present:
            present_dates.add(slot_date)
        else:
            absent_dates.add(slot_date)

        slots.append({
            'date': slot_date.strftime('%d/%m/%Y'),
            'routine_id': routine.id,
            'course': routine.course.name,
            'course_code': routine.course.code,
            'day': routine.day,
            'room': routine.room,
            'scheduled_time': f'{routine.start_time.strftime("%H:%M:%S")} - {routine.end_time.strftime("%H:%M:%S")}',
            'status': 'Present' if is_present else 'Absent',
            'check_in_time': attendance.check_in_time.strftime('%H:%M:%S') if attendance and attendance.check_in_time else None,
            'check_out_time': attendance.check_out_time.strftime('%H:%M:%S') if attendance and attendance.check_out_time else None,
        })

    return {
        'teacher_id': teacher.id,
        'teacher_name': teacher.name,
        'month': month,
        'year': year,
        'present_days': len(present_dates),
        'absent_days': len(absent_dates - present_dates),
        'slots': slots,
    }


# -------------------------
# ATTENDANCE
# -------------------------
class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceSerializer

    def get_permissions(self):
        if self.action in ['status', 'check_in', 'check_out', 'summary']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.select_related(
            'teacher', 'routine', 'routine__course'
        ).prefetch_related('actions')

        if user.is_superuser:
            teacher_id = self.request.query_params.get('teacher')
            month = self.request.query_params.get('month')
            year = self.request.query_params.get('year')
            day = self.request.query_params.get('day')

            if teacher_id:
                queryset = queryset.filter(teacher_id=teacher_id)
            if month:
                queryset = queryset.filter(month=month)
            if year:
                queryset = queryset.filter(year=year)
            if day:
                queryset = queryset.filter(date__day=day)

            return queryset.order_by('-date', '-check_in_time')

        if hasattr(user, 'teacher'):
            return queryset.filter(teacher=user.teacher).order_by('-date', '-check_in_time')

        return Attendance.objects.none()

    @action(detail=False, methods=['get'], url_path='status')
    def status(self, request):
        if not hasattr(request.user, 'teacher'):
            raise PermissionDenied("Only teachers can check attendance status.")

        teacher = request.user.teacher
        current_datetime = timezone.localtime()
        current_date = current_datetime.date()
        routines = Routine.objects.filter(
            teacher=teacher,
            day=current_datetime.strftime('%A')
        ).select_related('course', 'teacher')

        slots = []
        for routine in routines:
            attendance = Attendance.objects.filter(
                teacher=teacher,
                routine=routine,
                date=current_date,
            ).first()
            is_active = _is_routine_active_now(routine, current_datetime)

            slots.append({
                'routine': RoutineSerializer(routine).data,
                'date': current_date.strftime('%d/%m/%Y'),
                'month': current_date.month,
                'current_time': current_datetime.time().strftime('%H:%M:%S'),
                # Review: frontend shows disabled checkboxes, but backend is the final gate.
                'can_check_in': is_active and not (attendance and attendance.check_in_time),
                'can_check_out': is_active and bool(attendance and attendance.check_in_time and not attendance.check_out_time),
                'checked_in': bool(attendance and attendance.check_in_time),
                'checked_out': bool(attendance and attendance.check_out_time),
                'check_in_time': attendance.check_in_time.strftime('%H:%M:%S') if attendance and attendance.check_in_time else None,
                'check_out_time': attendance.check_out_time.strftime('%H:%M:%S') if attendance and attendance.check_out_time else None,
            })

        return Response({'slots': slots})

    def _record_action(self, request, action_type):
        if not hasattr(request.user, 'teacher'):
            raise PermissionDenied("Only teachers can check in or check out.")

        teacher = request.user.teacher
        routine_id = request.data.get('routine_id')
        current_datetime = timezone.localtime()
        current_date = current_datetime.date()

        try:
            routine = Routine.objects.get(id=routine_id, teacher=teacher)
        except Routine.DoesNotExist:
            raise PermissionDenied("This routine is not assigned to you.")

        if not _is_routine_active_now(routine, current_datetime):
            raise PermissionDenied("Attendance is only allowed during the scheduled routine time.")

        attendance, _ = Attendance.objects.get_or_create(
            teacher=teacher,
            routine=routine,
            date=current_date,
            defaults={
                'month': current_date.month,
                'year': current_date.year,
            },
        )

        if action_type == AttendanceAction.CHECK_IN:
            if attendance.check_in_time:
                return Response({"detail": "Already checked in for this routine."}, status=status.HTTP_400_BAD_REQUEST)
            attendance.check_in_time = current_datetime.time()
        else:
            if not attendance.check_in_time:
                return Response({"detail": "Check in before checking out."}, status=status.HTTP_400_BAD_REQUEST)
            if attendance.check_out_time:
                return Response({"detail": "Already checked out for this routine."}, status=status.HTTP_400_BAD_REQUEST)
            attendance.check_out_time = current_datetime.time()

        attendance.save()
        AttendanceAction.objects.create(
            attendance=attendance,
            teacher=teacher,
            date=current_date,
            month=current_date.month,
            year=current_date.year,
            time=current_datetime.time(),
            action_type=action_type,
        )

        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='check-in')
    def check_in(self, request):
        return self._record_action(request, AttendanceAction.CHECK_IN)

    @action(detail=False, methods=['post'], url_path='check-out')
    def check_out(self, request):
        return self._record_action(request, AttendanceAction.CHECK_OUT)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        now = timezone.localdate()
        year = _positive_int(request.query_params.get('year', now.year), 'Year', minimum=2000, maximum=2100)
        month = _positive_int(request.query_params.get('month', now.month), 'Month', minimum=1, maximum=12)
        day_param = request.query_params.get('day')
        day = _positive_int(day_param, 'Day', minimum=1, maximum=monthrange(year, month)[1]) if day_param else None

        if request.user.is_superuser:
            teacher_id = request.query_params.get('teacher')
            teachers = Teacher.objects.all().order_by('name')
            if teacher_id:
                teachers = teachers.filter(id=teacher_id)

            return Response({
                'month': month,
                'year': year,
                'reports': [
                    _attendance_summary_for_teacher(teacher, year, month, day)
                    for teacher in teachers
                ],
            })

        if not hasattr(request.user, 'teacher'):
            raise PermissionDenied("Only teachers and admins can view attendance summaries.")

        return Response(_attendance_summary_for_teacher(request.user.teacher, year, month, day))
