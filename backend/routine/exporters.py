import io

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Room, TimeSlot


EXCEL_HEADERS = ['Day', 'TimeSlot', 'Room', 'CourseCode', 'TeacherEmail', 'Section']


def _timeslot_label(time_slot):
    return f"{time_slot.start_time.strftime('%H:%M')}-{time_slot.end_time.strftime('%H:%M')}"


def export_routines_pdf(routines):
    rooms = list(Room.objects.order_by('name'))
    slots = list(TimeSlot.objects.order_by('order', 'start_time'))

    days_order = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    days_present = [day for day in days_order if any(r.day == day for r in routines)]
    if not days_present:
        days_present = days_order

    by_day_room_slot = {}
    for routine in routines:
        if routine.room_ref_id is None or routine.time_slot_id is None:
            continue
        by_day_room_slot[(routine.day, routine.room_ref_id, routine.time_slot_id)] = routine

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = []

    for index, day in enumerate(days_present):
        if index > 0:
            elements.append(PageBreak())
        elements.append(Paragraph(day, styles['Heading2']))
        elements.append(Spacer(1, 6))

        header_row = ['Room'] + [_timeslot_label(slot) for slot in slots]
        data = [header_row]

        for room in rooms:
            row = [room.name]
            for slot in slots:
                routine = by_day_room_slot.get((day, room.id, slot.id))
                if routine:
                    teacher_label = routine.teacher.name if routine.teacher else 'TBA'
                    cell = f"{routine.course.code} ({routine.section})\n{teacher_label}"
                else:
                    cell = ''
                row.append(cell)
            data.append(row)

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 18))

    doc.build(elements)
    return buffer.getvalue()


def export_routines_excel(routines):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Routine'
    sheet.append(EXCEL_HEADERS)

    for routine in routines:
        sheet.append([
            routine.day,
            _timeslot_label(routine.time_slot) if routine.time_slot else '',
            routine.room_ref.name if routine.room_ref else routine.room,
            routine.course.code,
            routine.teacher.email if routine.teacher else 'TBA',
            routine.section,
        ])

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
