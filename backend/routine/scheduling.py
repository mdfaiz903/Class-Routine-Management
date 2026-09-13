import random
from datetime import datetime

from django.db import transaction

from .models import Room, Routine, TimeSlot


class ConflictError(Exception):
    """Raised when placing a routine would double-book a teacher, room, or section."""


def find_conflicts(day, time_slot, teacher=None, room=None, section='', exclude_routine_id=None):
    """Return which dimensions are already booked for this day + time slot."""
    base = Routine.objects.filter(day=day, time_slot=time_slot)
    if exclude_routine_id is not None:
        base = base.exclude(id=exclude_routine_id)

    conflicts = {'teacher': False, 'room': False, 'section': False}

    if teacher is not None and base.filter(teacher=teacher).exists():
        conflicts['teacher'] = True
    if room is not None and base.filter(room_ref=room).exists():
        conflicts['room'] = True
    if section and base.filter(section=section).exists():
        conflicts['section'] = True

    return conflicts


def assert_no_conflicts(day, time_slot, teacher=None, room=None, section='', exclude_routine_id=None):
    conflicts = find_conflicts(day, time_slot, teacher, room, section, exclude_routine_id)

    if conflicts['teacher']:
        raise ConflictError(f"{teacher} is already scheduled on {day} at {time_slot}.")
    if conflicts['room']:
        raise ConflictError(f"Room {room} is already booked on {day} at {time_slot}.")
    if conflicts['section']:
        raise ConflictError(f"Section {section} already has a class on {day} at {time_slot}.")


def _rooms_of_type(room_type):
    if room_type:
        return list(Room.objects.filter(room_type=room_type))
    return list(Room.objects.all())


def _run_single_pass(requirements, days, slots, rooms_by_type, qualified_by_course):
    teacher_busy = set()
    room_busy = set()
    section_busy = set()
    teacher_session_count = {}

    for routine in Routine.objects.select_related('teacher').all():
        if routine.teacher_id is not None:
            teacher_session_count[routine.teacher_id] = teacher_session_count.get(routine.teacher_id, 0) + 1
        if routine.time_slot_id is None:
            continue
        teacher_busy.add((routine.teacher_id, routine.day, routine.time_slot_id))
        room_busy.add((routine.room_ref_id, routine.day, routine.time_slot_id))
        section_busy.add((routine.section, routine.day, routine.time_slot_id))

    sessions = [
        (requirement, session_index)
        for requirement in requirements
        for session_index in range(requirement.sessions_per_week)
    ]
    random.shuffle(sessions)

    placed = []
    unplaced = []

    for requirement, session_index in sessions:
        candidate_rooms = rooms_by_type.get(requirement.required_room_type or '', [])
        day_slot_combos = [(day, slot) for day in days for slot in slots]
        random.shuffle(day_slot_combos)
        auto_assign = requirement.teacher_id is None
        qualified_ids = qualified_by_course.get(requirement.course_id, []) if auto_assign else None
        if auto_assign:
            random.shuffle(qualified_ids)

        placement = None
        chosen_teacher_id = requirement.teacher_id
        for day, slot in day_slot_combos:
            if (requirement.section, day, slot.id) in section_busy:
                continue

            if auto_assign:
                available = [tid for tid in qualified_ids if (tid, day, slot.id) not in teacher_busy]
                if not available:
                    continue
                slot_teacher_id = min(available, key=lambda tid: teacher_session_count.get(tid, 0))
            else:
                if (requirement.teacher_id, day, slot.id) in teacher_busy:
                    continue
                slot_teacher_id = requirement.teacher_id

            room = next(
                (r for r in candidate_rooms if (r.id, day, slot.id) not in room_busy),
                None,
            )
            if room is None:
                continue

            placement = (day, slot, room)
            chosen_teacher_id = slot_teacher_id
            break

        if placement is None:
            room_type_note = f" of type {requirement.required_room_type}" if requirement.required_room_type else ""
            if auto_assign and not qualified_ids:
                reason = (
                    f"No teacher is specialized in {requirement.course}; add a specialization on a "
                    f"teacher or assign one directly on the requirement."
                )
            else:
                teacher_note = requirement.teacher if not auto_assign else "an available qualified teacher"
                reason = (
                    f"No free (day, time slot, room{room_type_note}) combination found for "
                    f"{requirement.course} / {requirement.section} with {teacher_note} "
                    f"without a teacher, section, or room conflict."
                )
            unplaced.append({
                'requirement_id': requirement.id,
                'session_index': session_index,
                'course_id': requirement.course_id,
                'teacher_id': requirement.teacher_id,
                'section': requirement.section,
                'placed': False,
                'reason': reason,
            })
            continue

        day, slot, room = placement
        teacher_busy.add((chosen_teacher_id, day, slot.id))
        room_busy.add((room.id, day, slot.id))
        section_busy.add((requirement.section, day, slot.id))
        if chosen_teacher_id is not None:
            teacher_session_count[chosen_teacher_id] = teacher_session_count.get(chosen_teacher_id, 0) + 1

        placed.append({
            'requirement_id': requirement.id,
            'session_index': session_index,
            'placed': True,
            'day': day,
            'time_slot_id': slot.id,
            'room_id': room.id,
            'teacher_id': chosen_teacher_id,
            'course_id': requirement.course_id,
            'section': requirement.section,
        })

    return placed, unplaced


def generate_preview(requirement_ids=None, attempts=5):
    from .models import RoutineRequirement, Teacher

    requirements = RoutineRequirement.objects.select_related('course', 'teacher')
    if requirement_ids:
        requirements = requirements.filter(id__in=requirement_ids)
    requirements = list(requirements)

    days = [choice[0] for choice in Routine.DAYS_OF_WEEK]
    slots = list(TimeSlot.objects.order_by('order', 'start_time'))
    rooms_by_type = {
        '': _rooms_of_type(None),
        Room.THEORY: _rooms_of_type(Room.THEORY),
        Room.LAB: _rooms_of_type(Room.LAB),
    }

    qualified_by_course = {}
    for teacher in Teacher.objects.prefetch_related('specializations').all():
        for course_id in teacher.specializations.values_list('id', flat=True):
            qualified_by_course.setdefault(course_id, []).append(teacher.id)

    best_placed, best_unplaced = [], None
    for _ in range(max(1, attempts)):
        placed, unplaced = _run_single_pass(requirements, days, slots, rooms_by_type, qualified_by_course)
        if best_unplaced is None or len(unplaced) < len(best_unplaced):
            best_placed, best_unplaced = placed, unplaced
        if not unplaced:
            break

    total_sessions = sum(r.sessions_per_week for r in requirements)
    return {
        'placed': best_placed,
        'unplaced': best_unplaced or [],
        'summary': {
            'total_sessions': total_sessions,
            'placed_count': len(best_placed),
            'unplaced_count': len(best_unplaced or []),
        },
    }


def _parse_ampm_range(text):
    """Parse "8:00 AM - 9:20 AM" into (start_time, end_time), or (None, None) if unparseable."""
    try:
        start_str, end_str = [part.strip() for part in text.split('-', 1)]
        return (
            datetime.strptime(start_str, '%I:%M %p').time(),
            datetime.strptime(end_str, '%I:%M %p').time(),
        )
    except (ValueError, IndexError):
        return None, None


def import_routine_grid_from_workbook(workbook):
    """Parse the Central_Class_Routine-style grid produced by export_routines_excel.

    Layout: repeating day blocks, each a day-title row, a time-slot header row (one
    "H:MM AM/PM - H:MM AM/PM" label per 3-column group), a Course Code|Section|Faculty
    sub-header row, then one row per Room with a Course Code/Section/Faculty triplet
    filled in per time slot where a class is scheduled.

    Never auto-creates referenced Course/Teacher(acronym)/Room/TimeSlot entities - unknown
    references are rejected. This is a destructive replace: if every cell parses and
    validates cleanly (including no teacher/section double-booking across rooms), ALL
    existing Routine rows are deleted and replaced with the parsed set inside one
    transaction. If anything fails to validate, nothing in the database is touched.
    """
    from .models import Course, Teacher

    sheet = workbook.active
    max_row = sheet.max_row
    max_col = sheet.max_column
    valid_days = {choice[0].lower(): choice[0] for choice in Routine.DAYS_OF_WEEK}

    def cell_text(r, c):
        value = sheet.cell(row=r, column=c).value
        return str(value).strip() if value is not None else ''

    def find_day(r):
        for c in range(1, min(max_col, 4) + 1):
            text = cell_text(r, c).lower()
            if text in valid_days:
                return valid_days[text]
        return None

    to_create = []
    errors = []
    pending_teacher_busy = set()
    pending_room_busy = set()
    pending_section_busy = set()
    total_cells = 0

    row = 1
    while row <= max_row:
        day = find_day(row)
        if not day:
            row += 1
            continue

        header_row = row + 1
        subheader_row = row + 2
        if subheader_row > max_row:
            break

        timeslot_groups = []
        col = 2
        while col <= max_col:
            header_text = cell_text(header_row, col)
            if not header_text:
                break
            start_t, end_t = _parse_ampm_range(header_text)
            time_slot = None
            if start_t and end_t:
                time_slot = TimeSlot.objects.filter(
                    start_time__hour=start_t.hour, start_time__minute=start_t.minute,
                    end_time__hour=end_t.hour, end_time__minute=end_t.minute,
                ).first()
            if time_slot is None:
                errors.append({
                    'row': header_row,
                    'error': f"{day}: no matching timeslot for '{header_text}' - configure timeslots first.",
                })
            timeslot_groups.append((col, header_text, time_slot))
            col += 3

        data_row = subheader_row + 1
        while data_row <= max_row:
            room_label = cell_text(data_row, 1)
            if not room_label or find_day(data_row):
                break

            room = Room.objects.filter(name=room_label).first()
            if room is None:
                errors.append({'row': data_row, 'error': f"{day}: unknown room '{room_label}'."})
                data_row += 1
                continue

            for start_col, header_text, time_slot in timeslot_groups:
                if time_slot is None:
                    continue
                course_code = cell_text(data_row, start_col)
                if not course_code:
                    continue
                total_cells += 1
                section = cell_text(data_row, start_col + 1)
                faculty_code = cell_text(data_row, start_col + 2)

                course = Course.objects.filter(code=course_code).first()
                if course is None:
                    errors.append({
                        'row': data_row,
                        'error': f"{day} {room_label} {header_text}: unknown course code '{course_code}'.",
                    })
                    continue

                teacher = None
                if faculty_code and faculty_code.upper() != 'TBA':
                    teacher = Teacher.objects.filter(acronym=faculty_code).first()
                    if teacher is None:
                        errors.append({
                            'row': data_row,
                            'error': f"{day} {room_label} {header_text}: unknown faculty acronym '{faculty_code}'.",
                        })
                        continue

                teacher_key = (teacher.id if teacher else None, day, time_slot.id)
                room_key = (room.id, day, time_slot.id)
                section_key = (section, day, time_slot.id)
                if teacher and teacher_key in pending_teacher_busy:
                    errors.append({'row': data_row, 'error': f"{teacher} is double-booked on {day} at {header_text}."})
                    continue
                if room_key in pending_room_busy:
                    errors.append({'row': data_row, 'error': f"Room {room} is double-booked on {day} at {header_text}."})
                    continue
                if section and section_key in pending_section_busy:
                    errors.append({'row': data_row, 'error': f"Section {section} is double-booked on {day} at {header_text}."})
                    continue

                if teacher:
                    pending_teacher_busy.add(teacher_key)
                pending_room_busy.add(room_key)
                if section:
                    pending_section_busy.add(section_key)

                to_create.append({
                    'teacher': teacher,
                    'course': course,
                    'day': day,
                    'section': section,
                    'room_ref': room,
                    'time_slot': time_slot,
                    'start_time': time_slot.start_time,
                    'end_time': time_slot.end_time,
                    'room': room.name,
                })

            data_row += 1

        row = data_row

    if errors:
        return {
            'total_rows': total_cells,
            'created_count': 0,
            'failed_count': len(errors),
            'created': [],
            'errors': errors,
        }

    with transaction.atomic():
        Routine.objects.all().delete()
        created = [
            {'row': None, 'routine_id': Routine.objects.create(**entry).id}
            for entry in to_create
        ]

    return {
        'total_rows': total_cells,
        'created_count': len(created),
        'failed_count': 0,
        'created': created,
        'errors': [],
    }
