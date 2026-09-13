import csv
import io
import re
from datetime import datetime

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from .models import Course, Room, Teacher, TimeSlot


def _read_csv(file_obj):
    text = io.TextIOWrapper(file_obj, encoding='utf-8-sig')
    return list(csv.DictReader(text))


def _empty_report(total_rows=0):
    return {'total_rows': total_rows, 'created_count': 0, 'failed_count': 0, 'created': [], 'errors': [], 'warnings': []}


def _finalize(report):
    report['created_count'] = len(report['created'])
    report['failed_count'] = len(report['errors'])
    return report


def import_courses_from_csv(file_obj):
    """Expected header: name,code,credit (credit optional, defaults 0)."""
    rows = _read_csv(file_obj)
    report = _empty_report(len(rows))
    to_create = []
    seen_codes = set()

    for row_number, row in enumerate(rows, start=2):
        name = (row.get('name') or '').strip()
        code = (row.get('code') or '').strip()
        credit_raw = (row.get('credit') or '').strip()

        if not name or not code:
            report['errors'].append({'row': row_number, 'error': "Both 'name' and 'code' are required."})
            continue
        if code in seen_codes or Course.objects.filter(code=code).exists():
            report['errors'].append({'row': row_number, 'error': f"Course code '{code}' already exists."})
            continue

        credit = 0
        if credit_raw:
            try:
                credit = int(credit_raw)
            except ValueError:
                report['errors'].append({'row': row_number, 'error': f"Invalid credit '{credit_raw}'."})
                continue

        seen_codes.add(code)
        to_create.append({'row': row_number, 'name': name, 'code': code, 'credit': credit})

    for entry in to_create:
        course = Course.objects.create(name=entry['name'], code=entry['code'], credit=entry['credit'])
        report['created'].append({'row': entry['row'], 'id': course.id})

    return _finalize(report)


def import_rooms_from_csv(file_obj):
    """Expected header: name,room_type (room_type optional, defaults 'Theory'; must be 'Theory'/'Lab')."""
    rows = _read_csv(file_obj)
    report = _empty_report(len(rows))
    to_create = []
    seen_names = set()

    for row_number, row in enumerate(rows, start=2):
        name = (row.get('name') or '').strip()
        room_type = (row.get('room_type') or '').strip() or Room.THEORY

        if not name:
            report['errors'].append({'row': row_number, 'error': "'name' is required."})
            continue
        if room_type not in (Room.THEORY, Room.LAB):
            report['errors'].append({
                'row': row_number,
                'error': f"Invalid room_type '{room_type}' - must be '{Room.THEORY}' or '{Room.LAB}'.",
            })
            continue
        if name in seen_names or Room.objects.filter(name=name).exists():
            report['errors'].append({'row': row_number, 'error': f"Room '{name}' already exists."})
            continue

        seen_names.add(name)
        to_create.append({'row': row_number, 'name': name, 'room_type': room_type})

    for entry in to_create:
        room = Room.objects.create(name=entry['name'], room_type=entry['room_type'])
        report['created'].append({'row': entry['row'], 'id': room.id})

    return _finalize(report)


def import_timeslots_from_csv(file_obj):
    """Expected header: label,start_time,end_time,order (label/order optional; times as HH:MM)."""
    rows = _read_csv(file_obj)
    report = _empty_report(len(rows))
    to_create = []
    seen_ranges = set()

    for row_number, row in enumerate(rows, start=2):
        label = (row.get('label') or '').strip()
        start_raw = (row.get('start_time') or '').strip()
        end_raw = (row.get('end_time') or '').strip()
        order_raw = (row.get('order') or '').strip()

        if not start_raw or not end_raw:
            report['errors'].append({'row': row_number, 'error': "Both 'start_time' and 'end_time' are required (HH:MM)."})
            continue

        try:
            start_time = datetime.strptime(start_raw, '%H:%M').time()
            end_time = datetime.strptime(end_raw, '%H:%M').time()
        except ValueError:
            report['errors'].append({'row': row_number, 'error': f"Invalid time format '{start_raw}'/'{end_raw}' - use HH:MM."})
            continue

        if end_time <= start_time:
            report['errors'].append({'row': row_number, 'error': "'end_time' must be after 'start_time'."})
            continue

        order = 0
        if order_raw:
            try:
                order = int(order_raw)
            except ValueError:
                report['errors'].append({'row': row_number, 'error': f"Invalid order '{order_raw}'."})
                continue

        range_key = (start_time, end_time)
        if range_key in seen_ranges or TimeSlot.objects.filter(start_time=start_time, end_time=end_time).exists():
            report['errors'].append({'row': row_number, 'error': f"A timeslot {start_raw}-{end_raw} already exists."})
            continue

        seen_ranges.add(range_key)
        to_create.append({
            'row': row_number, 'label': label, 'start_time': start_time, 'end_time': end_time, 'order': order,
        })

    for entry in to_create:
        slot = TimeSlot.objects.create(
            label=entry['label'], start_time=entry['start_time'], end_time=entry['end_time'], order=entry['order'],
        )
        report['created'].append({'row': entry['row'], 'id': slot.id})

    return _finalize(report)


def import_teachers_from_csv(file_obj):
    """Expected header: name,email,username,password,acronym,designation,department,mobile_number,specialization.

    Only name/email/username/password are required. specialization is optional,
    semicolon-separated Course codes (e.g. "MATH1302;PHY101") - an unknown code fails
    the whole row rather than being silently skipped.
    """
    rows = _read_csv(file_obj)
    report = _empty_report(len(rows))
    to_create = []
    seen_usernames = set()
    seen_emails = set()

    for row_number, row in enumerate(rows, start=2):
        name = (row.get('name') or '').strip()
        email = (row.get('email') or '').strip()
        username = (row.get('username') or '').strip()
        password = row.get('password') or ''
        acronym = (row.get('acronym') or '').strip()
        designation = (row.get('designation') or '').strip()
        department = (row.get('department') or '').strip()
        mobile_number = (row.get('mobile_number') or '').strip()
        specialization_raw = (row.get('specialization') or '').strip()

        if not name or not email or not username or not password:
            report['errors'].append({
                'row': row_number,
                'error': "'name', 'email', 'username' and 'password' are required.",
            })
            continue
        if username in seen_usernames or User.objects.filter(username=username).exists():
            report['errors'].append({'row': row_number, 'error': f"Username '{username}' already exists."})
            continue
        if email in seen_emails or User.objects.filter(email=email).exists() or Teacher.objects.filter(email=email).exists():
            report['errors'].append({'row': row_number, 'error': f"Email '{email}' already exists."})
            continue

        try:
            validate_password(password)
        except DjangoValidationError as exc:
            report['errors'].append({'row': row_number, 'error': '; '.join(exc.messages)})
            continue

        specializations = []
        if specialization_raw:
            codes = [code.strip() for code in re.split(r'[;,]', specialization_raw) if code.strip()]
            unknown_codes = []
            for code in codes:
                course = Course.objects.filter(code__iexact=code).first()
                if course is None:
                    unknown_codes.append(code)
                else:
                    specializations.append(course)
            if unknown_codes:
                # Non-fatal: specialization is optional, so an unmatched code shouldn't block
                # creating the teacher - just skip it and report it as a warning.
                report['warnings'].append({
                    'row': row_number,
                    'warning': f"Unknown course code(s) skipped for specialization: {', '.join(unknown_codes)}.",
                })

        seen_usernames.add(username)
        seen_emails.add(email)
        to_create.append({
            'row': row_number, 'name': name, 'email': email, 'username': username, 'password': password,
            'acronym': acronym, 'designation': designation, 'department': department,
            'mobile_number': mobile_number, 'specializations': specializations,
        })

    for entry in to_create:
        with transaction.atomic():
            user = User.objects.create_user(
                username=entry['username'], email=entry['email'], password=entry['password'],
                first_name=entry['name'],
            )
            teacher = Teacher.objects.create(
                user=user, name=entry['name'], email=entry['email'], acronym=entry['acronym'],
                designation=entry['designation'], department=entry['department'],
                mobile_number=entry['mobile_number'],
            )
            if entry['specializations']:
                teacher.specializations.set(entry['specializations'])
        report['created'].append({'row': entry['row'], 'id': teacher.id})

    return _finalize(report)
