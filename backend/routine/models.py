from django.db import models
from django.contrib.auth.models import User
# Create your models here.
class Teacher(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True, default='')
    
    def __str__(self):
        return self.name 

class Course(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10)
    
    def __str__(self):
        return f"{self.name}-{self.code}"
    
class Routine(models.Model):
    DAYS_OF_WEEK = [
        ('Monday', 'Monday'),
        ('Tuesday', 'Tuesday'),
        ('Wednesday', 'Wednesday'),
        ('Thursday', 'Thursday'),
        ('Friday', 'Friday'),
        ('Saturday', 'Saturday'),
        ('Sunday', 'Sunday'),
    ]
    teacher = models.ForeignKey(Teacher, on_delete = models.CASCADE)
    course = models.ForeignKey(Course, on_delete = models.CASCADE)
    day = models.CharField(max_length=20, choices=DAYS_OF_WEEK)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50)
    
    def __str__(self):
        return f"{self.course} by {self.teacher} on {self.day} from {self.start_time} to {self.end_time} at {self.room}"


class RoutineEnrollment(models.Model):
    routine = models.ForeignKey(Routine, related_name='enrollments', on_delete=models.CASCADE)
    student = models.ForeignKey(User, related_name='routine_enrollments', on_delete=models.CASCADE)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['routine', 'student'],
                name='unique_student_routine_enrollment',
            )
        ]
        ordering = ['routine__day', 'routine__start_time', 'student__username']

    def __str__(self):
        return f"{self.student.username} enrolled in {self.routine}"
    
class RoutineChangeRequest(models.Model):
    CHOICE = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]
    routine = models.ForeignKey(Routine, on_delete=models.CASCADE)
    requested_by = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    reason = models.TextField()
    status = models.CharField(max_length=30, choices=CHOICE, default='Pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Change Request for {self.routine} by {self.requested_by}"


class Attendance(models.Model):
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    routine = models.ForeignKey(Routine, on_delete=models.CASCADE)
    date = models.DateField()
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['teacher', 'routine', 'date'],
                name='unique_teacher_routine_attendance_date',
            )
        ]

    def __str__(self):
        return f"{self.teacher} attendance for {self.routine} on {self.date}"


class AttendanceAction(models.Model):
    CHECK_IN = 'Check-In'
    CHECK_OUT = 'Check-Out'
    ACTION_CHOICES = [
        (CHECK_IN, CHECK_IN),
        (CHECK_OUT, CHECK_OUT),
    ]

    attendance = models.ForeignKey(Attendance, related_name='actions', on_delete=models.CASCADE)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    date = models.DateField()
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    time = models.TimeField()
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-time']

    def __str__(self):
        return f"{self.action_type} by {self.teacher} on {self.date} at {self.time}"
