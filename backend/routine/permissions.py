from rest_framework import permissions


# -------------------------
# ONLY ADMIN (SUPERUSER)
# -------------------------
class IsAdminUser(permissions.BasePermission):
    """
    Allows access only to admin (superuser).
    """

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_superuser
        )


# -------------------------
# TEACHER ONLY
# -------------------------
class IsTeacher(permissions.BasePermission):
    """
    Allows access only to users who have Teacher profile.
    """

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'teacher')
        )


# -------------------------
# TEACHER OWNER OR READ ONLY
# -------------------------
class IsTeacherOwnerOrReadOnly(permissions.BasePermission):

    def has_object_permission(self, request, view, obj):

        # SAFE METHODS (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return True

        # If object is linked to Teacher model
        if hasattr(obj, 'teacher'):
            return obj.teacher.user == request.user

        # If object is Teacher itself
        if hasattr(obj, 'user'):
            return obj.user == request.user

        return False