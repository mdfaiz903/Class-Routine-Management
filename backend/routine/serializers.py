from .models import Attendance, AttendanceAction, Routine, RoutineChangeRequest, RoutineEnrollment, Teacher, Course
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password


# -------------------------
# JWT TOKEN
# -------------------------
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Review: keep frontend role checks stable for Student, Teacher, and Admin users.
        token['username'] = user.username
        token['is_superuser'] = user.is_superuser
        token['is_staff'] = user.is_staff

        if user.is_superuser:
            token['role'] = 'Admin'
        elif hasattr(user, 'teacher'):
            token['role'] = 'Teacher'
        else:
            token['role'] = 'Student'

        return token


# -------------------------
# REGISTER (ONLY USER CREATION)
# -------------------------
class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })

        validate_password(attrs['password'])
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        username = validated_data.pop('username')
        email = validated_data.pop('email')
        name = validated_data.pop('name')

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name
        )

        return user


# -------------------------
# USER LIST (ADMIN SELECTS TEACHER USER)
# -------------------------
class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name', read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email', 'role']

    def get_role(self, user):
        # Review: admin uses this role to decide which users can become teachers.
        if user.is_superuser:
            return 'Admin'
        if hasattr(user, 'teacher'):
            return 'Teacher'
        return 'Student'


# -------------------------
# TEACHER (ADMIN CREATES ROLE)
# -------------------------
class TeacherSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user'
    )

    name = serializers.CharField(read_only=True)
    email = serializers.CharField(read_only=True)
    class Meta:
        model = Teacher
        fields = ['id', 'user_id', 'name', 'email']

    def validate_user_id(self, user):
        if user.is_superuser:
            raise serializers.ValidationError("Superuser already has admin access.")
        if hasattr(user, 'teacher'):
            raise serializers.ValidationError("This user is already a teacher.")
        return user

    def create(self, validated_data):
        user = validated_data['user']

        teacher = Teacher.objects.create(
            user=user,
            name=user.first_name,
            email=user.email
        )

        return teacher

        
class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'name', 'code']     


class RoutineEnrollmentSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='student',
        write_only=True
    )
    routine_id = serializers.PrimaryKeyRelatedField(
        queryset=Routine.objects.all(),
        source='routine',
        write_only=True
    )
    routine = serializers.SerializerMethodField()

    class Meta:
        model = RoutineEnrollment
        fields = ['id', 'routine', 'routine_id', 'student', 'student_id', 'enrolled_at']

    def get_routine(self, enrollment):
        routine = enrollment.routine
        return {
            'id': routine.id,
            'day': routine.day,
            'start_time': routine.start_time.strftime('%H:%M:%S'),
            'end_time': routine.end_time.strftime('%H:%M:%S'),
            'room': routine.room,
            'course': CourseSerializer(routine.course).data,
            'teacher': TeacherSerializer(routine.teacher).data,
        }

    def validate_student_id(self, user):
        if user.is_superuser:
            raise serializers.ValidationError("Admin users cannot be enrolled as students.")
        if hasattr(user, 'teacher'):
            raise serializers.ValidationError("Teacher users cannot be enrolled as students.")
        return user

    def validate(self, attrs):
        routine = attrs.get('routine')
        student = attrs.get('student')

        if RoutineEnrollment.objects.filter(routine=routine, student=student).exists():
            raise serializers.ValidationError("This student is already enrolled in this routine.")

        return attrs
        
class RoutineSerializer(serializers.ModelSerializer):
    teacher = TeacherSerializer(read_only=True)
    teacher_id = serializers.PrimaryKeyRelatedField(queryset=Teacher.objects.all(), source='teacher', write_only=True)
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), source='course', write_only=True)
    enrollments = RoutineEnrollmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Routine
        fields = [
            'id', 'teacher', 'teacher_id', 'course', 'course_id', 'day',
            'start_time', 'end_time', 'room', 'enrollments'
        ]       
        
        
class RoutineChangeRequestSerializer(serializers.ModelSerializer):
    routine = RoutineSerializer(read_only=True)
    routine_id = serializers.PrimaryKeyRelatedField(queryset=Routine.objects.all(), source='routine', write_only=True)
    requested_by = TeacherSerializer(read_only=True)
    
    class Meta:
        model = RoutineChangeRequest
        fields = ['id', 'routine', 'routine_id', 'requested_by', 'reason', 'status', 'requested_at']  


class AttendanceActionSerializer(serializers.ModelSerializer):
    teacher = TeacherSerializer(read_only=True)
    date_display = serializers.SerializerMethodField()
    time_display = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceAction
        fields = [
            'id', 'attendance', 'teacher', 'date', 'date_display', 'month',
            'year', 'time', 'time_display', 'action_type', 'created_at'
        ]

    def get_date_display(self, action):
        return action.date.strftime('%d/%m/%Y')

    def get_time_display(self, action):
        return action.time.strftime('%H:%M:%S')


class AttendanceSerializer(serializers.ModelSerializer):
    teacher = TeacherSerializer(read_only=True)
    routine = RoutineSerializer(read_only=True)
    actions = AttendanceActionSerializer(many=True, read_only=True)
    date_display = serializers.SerializerMethodField()
    check_in_time_display = serializers.SerializerMethodField()
    check_out_time_display = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'teacher', 'routine', 'date', 'date_display', 'month', 'year',
            'check_in_time', 'check_in_time_display', 'check_out_time',
            'check_out_time_display', 'actions'
        ]

    def get_date_display(self, attendance):
        return attendance.date.strftime('%d/%m/%Y')

    def get_check_in_time_display(self, attendance):
        if not attendance.check_in_time:
            return None
        return attendance.check_in_time.strftime('%H:%M:%S')

    def get_check_out_time_display(self, attendance):
        if not attendance.check_out_time:
            return None
        return attendance.check_out_time.strftime('%H:%M:%S')
