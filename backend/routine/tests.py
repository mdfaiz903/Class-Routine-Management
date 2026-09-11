from datetime import time

from django.contrib.auth.models import User
from django.test import TestCase
from openpyxl import load_workbook
from rest_framework.test import APIClient

from . import scheduling
from .exporters import export_routines_excel, export_routines_pdf
from .models import Course, Room, Routine, RoutineRequirement, Teacher, TimeSlot


def make_teacher(username, email):
    user = User.objects.create_user(username=username, password='pass1234', email=email, first_name=username)
    return Teacher.objects.create(user=user, name=username, email=email)


class SchedulingConflictTests(TestCase):
    def setUp(self):
        self.teacher = make_teacher('t1', 't1@example.com')
        self.course = Course.objects.create(name='Data Structures', code='CSE1101')
        self.room = Room.objects.create(name='401(MB)', room_type=Room.THEORY)
        self.slot = TimeSlot.objects.create(start_time=time(9, 0), end_time=time(10, 30), order=1)

    def test_no_conflict_for_first_booking(self):
        scheduling.assert_no_conflicts(day='Saturday', time_slot=self.slot, teacher=self.teacher, room=self.room, section='1A')

    def test_teacher_double_booking_raises(self):
        Routine.objects.create(
            teacher=self.teacher, course=self.course, day='Saturday', section='1A',
            room_ref=self.room, time_slot=self.slot,
            start_time=self.slot.start_time, end_time=self.slot.end_time, room=self.room.name,
        )
        other_room = Room.objects.create(name='402(MB)', room_type=Room.THEORY)
        with self.assertRaises(scheduling.ConflictError):
            scheduling.assert_no_conflicts(day='Saturday', time_slot=self.slot, teacher=self.teacher, room=other_room, section='1B')

    def test_room_double_booking_raises(self):
        Routine.objects.create(
            teacher=self.teacher, course=self.course, day='Saturday', section='1A',
            room_ref=self.room, time_slot=self.slot,
            start_time=self.slot.start_time, end_time=self.slot.end_time, room=self.room.name,
        )
        other_teacher = make_teacher('t2', 't2@example.com')
        with self.assertRaises(scheduling.ConflictError):
            scheduling.assert_no_conflicts(day='Saturday', time_slot=self.slot, teacher=other_teacher, room=self.room, section='1B')

    def test_excludes_own_routine_id_on_update(self):
        routine = Routine.objects.create(
            teacher=self.teacher, course=self.course, day='Saturday', section='1A',
            room_ref=self.room, time_slot=self.slot,
            start_time=self.slot.start_time, end_time=self.slot.end_time, room=self.room.name,
        )
        scheduling.assert_no_conflicts(
            day='Saturday', time_slot=self.slot, teacher=self.teacher, room=self.room,
            section='1A', exclude_routine_id=routine.id,
        )


class GeneratorTests(TestCase):
    def setUp(self):
        self.teacher = make_teacher('gen1', 'gen1@example.com')
        self.course = Course.objects.create(name='Algorithms', code='CSE2101')
        Room.objects.create(name='R1', room_type=Room.THEORY)
        TimeSlot.objects.create(start_time=time(9, 0), end_time=time(10, 30), order=1)
        TimeSlot.objects.create(start_time=time(10, 40), end_time=time(12, 10), order=2)

    def test_places_all_sessions_when_capacity_available(self):
        requirement = RoutineRequirement.objects.create(
            course=self.course, teacher=self.teacher, section='2A', sessions_per_week=2,
        )
        result = scheduling.generate_preview(requirement_ids=[requirement.id])
        self.assertEqual(result['summary']['placed_count'], 2)
        self.assertEqual(result['summary']['unplaced_count'], 0)

    def test_reports_unplaced_when_no_room_of_required_type(self):
        requirement = RoutineRequirement.objects.create(
            course=self.course, teacher=self.teacher, section='2A', sessions_per_week=1,
            required_room_type=Room.LAB,
        )
        result = scheduling.generate_preview(requirement_ids=[requirement.id])
        self.assertEqual(result['summary']['placed_count'], 0)
        self.assertEqual(result['summary']['unplaced_count'], 1)
        self.assertIn('reason', result['unplaced'][0])


class ExportImportTests(TestCase):
    def setUp(self):
        self.teacher = make_teacher('exp1', 'exp1@example.com')
        self.course = Course.objects.create(name='Databases', code='CSE2201')
        self.room = Room.objects.create(name='403(MB)', room_type=Room.THEORY)
        self.slot = TimeSlot.objects.create(start_time=time(9, 0), end_time=time(10, 30), order=1)
        self.routine = Routine.objects.create(
            teacher=self.teacher, course=self.course, day='Saturday', section='3B',
            room_ref=self.room, time_slot=self.slot,
            start_time=self.slot.start_time, end_time=self.slot.end_time, room=self.room.name,
        )

    def test_pdf_export_produces_bytes(self):
        content = export_routines_pdf(Routine.objects.all())
        self.assertTrue(content.startswith(b'%PDF'))

    def test_excel_export_round_trips_through_import(self):
        content = export_routines_excel(Routine.objects.all())
        Routine.objects.all().delete()

        import io
        workbook = load_workbook(io.BytesIO(content))
        report = scheduling.import_routines_from_workbook(workbook)
        self.assertEqual(report['created_count'], 1)
        self.assertEqual(report['failed_count'], 0)
        self.assertEqual(Routine.objects.count(), 1)

    def test_import_rejects_unknown_room(self):
        import io
        from openpyxl import Workbook
        wb = Workbook()
        sheet = wb.active
        sheet.append(['Day', 'TimeSlot', 'Room', 'CourseCode', 'TeacherEmail', 'Section'])
        sheet.append(['Saturday', '09:00-10:30', 'Nonexistent Room', 'CSE2201', 'exp1@example.com', '1A'])
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        workbook = load_workbook(buffer)

        report = scheduling.import_routines_from_workbook(workbook)
        self.assertEqual(report['created_count'], 0)
        self.assertEqual(report['failed_count'], 1)
        self.assertIn('Unknown room', report['errors'][0]['error'])


class RoutineApiPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password='pass1234', email='admin@example.com')
        self.student = User.objects.create_user(username='student', password='pass1234', email='student@example.com')

    def test_non_admin_cannot_generate(self):
        self.client.force_authenticate(self.student)
        response = self.client.post('/api/routines/generate/', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_generate_empty_preview(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/routines/generate/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['total_sessions'], 0)

    def test_export_pdf_via_api(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/routines/export/?type=pdf')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')

    def test_export_excel_via_api(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/routines/export/?type=excel')
        self.assertEqual(response.status_code, 200)

    def test_export_missing_type_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/routines/export/')
        self.assertEqual(response.status_code, 400)

    def test_non_admin_cannot_import_excel(self):
        self.client.force_authenticate(self.student)
        response = self.client.post('/api/routines/import-excel/', {}, format='multipart')
        self.assertEqual(response.status_code, 403)
