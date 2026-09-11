import random

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


def _run_single_pass(requirements, days, slots, rooms_by_type):
    teacher_busy = set()
    room_busy = set()
    section_busy = set()

    for routine in Routine.objects.select_related('teacher').all():
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

        placement = None
        for day, slot in day_slot_combos:
            if (requirement.teacher_id, day, slot.id) in teacher_busy:
                continue
            if (requirement.section, day, slot.id) in section_busy:
                continue

            room = next(
                (r for r in candidate_rooms if (r.id, day, slot.id) not in room_busy),
                None,
            )
            if room is None:
                continue

            placement = (day, slot, room)
            break

        if placement is None:
            room_type_note = f" of type {requirement.required_room_type}" if requirement.required_room_type else ""
            unplaced.append({
                'requirement_id': requirement.id,
                'session_index': session_index,
                'course_id': requirement.course_id,
                'teacher_id': requirement.teacher_id,
                'section': requirement.section,
                'placed': False,
                'reason': (
                    f"No free (day, time slot, room{room_type_note}) combination found for "
                    f"{requirement.course} / {requirement.section} with {requirement.teacher} "
                    f"without a teacher, section, or room conflict."
                ),
            })
            continue

        day, slot, room = placement
        teacher_busy.add((requirement.teacher_id, day, slot.id))
        room_busy.add((room.id, day, slot.id))
        section_busy.add((requirement.section, day, slot.id))

        placed.append({
            'requirement_id': requirement.id,
            'session_index': session_index,
            'placed': True,
            'day': day,
            'time_slot_id': slot.id,
            'room_id': room.id,
            'teacher_id': requirement.teacher_id,
            'course_id': requirement.course_id,
            'section': requirement.section,
        })

    return placed, unplaced


def generate_preview(requirement_ids=None, attempts=5):
    from .models import RoutineRequirement

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

    best_placed, best_unplaced = [], None
    for _ in range(max(1, attempts)):
        placed, unplaced = _run_single_pass(requirements, days, slots, rooms_by_type)
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


def import_routines_from_workbook(workbook):
    """Parse a flat-table Excel workbook (openpyxl Workbook) into Routine rows.

    Expected header row (case-insensitive): Day | TimeSlot | Room | CourseCode | TeacherEmail | Section
    Returns a report dict with created/failed counts and per-row errors. Never auto-creates
    referenced Course/Teacher/Room/TimeSlot entities - unknown references are rejected.
    """
    from .models import Course, Teacher

    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return {'total_rows': 0, 'created_count': 0, 'failed_count': 0, 'created': [], 'errors': []}

    header = [str(cell).strip().lower() if cell is not None else '' for cell in rows[0]]
    required_columns = ['day', 'timeslot', 'room', 'coursecode', 'teacheremail', 'section']
    column_index = {}
    for name in required_columns:
        if name not in header:
            return {
                'total_rows': 0,
                'created_count': 0,
                'failed_count': 0,
                'created': [],
                'errors': [{'row': 1, 'error': f"Missing required column '{name}'."}],
            }
        column_index[name] = header.index(name)

    valid_days = {choice[0].lower(): choice[0] for choice in Routine.DAYS_OF_WEEK}
    to_create = []
    errors = []

    pending_teacher_busy = set()
    pending_room_busy = set()
    pending_section_busy = set()

    for row_number, row in enumerate(rows[1:], start=2):
        if row is None or all(cell is None for cell in row):
            continue

        def cell(name):
            value = row[column_index[name]]
            return str(value).strip() if value is not None else ''

        day_raw = cell('day')
        day = valid_days.get(day_raw.lower())
        if not day:
            errors.append({'row': row_number, 'error': f"Unknown day '{day_raw}'."})
            continue

        timeslot_raw = cell('timeslot')
        time_slot = None
        try:
            start_str, end_str = [part.strip() for part in timeslot_raw.split('-', 1)]
            time_slot = TimeSlot.objects.filter(
                start_time__hour=int(start_str.split(':')[0]),
                start_time__minute=int(start_str.split(':')[1]),
                end_time__hour=int(end_str.split(':')[0]),
                end_time__minute=int(end_str.split(':')[1]),
            ).first()
        except (ValueError, IndexError):
            time_slot = None
        if time_slot is None:
            errors.append({
                'row': row_number,
                'error': f"No matching timeslot for '{timeslot_raw}' - configure timeslots first.",
            })
            continue

        room_raw = cell('room')
        room = Room.objects.filter(name=room_raw).first()
        if room is None:
            errors.append({'row': row_number, 'error': f"Unknown room '{room_raw}'."})
            continue

        course_raw = cell('coursecode')
        course = Course.objects.filter(code=course_raw).first()
        if course is None:
            errors.append({'row': row_number, 'error': f"Unknown course code '{course_raw}'."})
            continue

        teacher_raw = cell('teacheremail')
        teacher = None
        if teacher_raw and teacher_raw.upper() != 'TBA':
            teacher = Teacher.objects.filter(email=teacher_raw).first()
            if teacher is None:
                errors.append({'row': row_number, 'error': f"Unknown teacher email '{teacher_raw}'."})
                continue

        section = cell('section')

        try:
            assert_no_conflicts(day, time_slot, teacher, room, section)
        except ConflictError as exc:
            errors.append({'row': row_number, 'error': str(exc)})
            continue

        teacher_key = (teacher.id if teacher else None, day, time_slot.id)
        room_key = (room.id, day, time_slot.id)
        section_key = (section, day, time_slot.id)
        if teacher and teacher_key in pending_teacher_busy:
            errors.append({'row': row_number, 'error': f"{teacher} is double-booked within this file on {day}."})
            continue
        if room_key in pending_room_busy:
            errors.append({'row': row_number, 'error': f"Room {room} is double-booked within this file on {day}."})
            continue
        if section and section_key in pending_section_busy:
            errors.append({'row': row_number, 'error': f"Section {section} is double-booked within this file on {day}."})
            continue

        if teacher:
            pending_teacher_busy.add(teacher_key)
        pending_room_busy.add(room_key)
        if section:
            pending_section_busy.add(section_key)

        to_create.append({
            'row': row_number,
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

    created = []
    for entry in to_create:
        routine = Routine.objects.create(
            teacher=entry['teacher'],
            course=entry['course'],
            day=entry['day'],
            section=entry['section'],
            room_ref=entry['room_ref'],
            time_slot=entry['time_slot'],
            start_time=entry['start_time'],
            end_time=entry['end_time'],
            room=entry['room'],
        )
        created.append({'row': entry['row'], 'routine_id': routine.id})

    return {
        'total_rows': len(rows) - 1,
        'created_count': len(created),
        'failed_count': len(errors),
        'created': created,
        'errors': errors,
    }
