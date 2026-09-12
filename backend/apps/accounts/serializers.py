from rest_framework import serializers

from .captcha import MAX_TOKEN_LENGTH
from .models import User
from .validators import normalize_email


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    # Not trimmed: whitespace can be part of a password. Capped so a
    # multi-megabyte "password" cannot be used to make the hasher do work.
    password = serializers.CharField(max_length=1024, trim_whitespace=False, write_only=True)
    captcha_token = serializers.CharField(
        max_length=MAX_TOKEN_LENGTH, allow_blank=True, default="", write_only=True
    )

    def validate_email(self, value):
        return normalize_email(value)


class UserSerializer(serializers.ModelSerializer):
    """
    The whole of what a client learns about a user. Add a field here
    deliberately; never widen this to `fields = "__all__"`.
    """

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "is_staff")
        read_only_fields = fields
