"""
Request validation for the knowledge-base API.

Input only. Responses are built by presenters.py: they are nested read
models assembled from several tables, which plain functions express more
clearly than serializer classes, and they never accept input.
"""

import re

from django.conf import settings
from rest_framework import serializers

from .constants import SourceType
from .validators import clean_tags

_LANGUAGE = re.compile(r"^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$")


def _language(value):
    value = (value or "").strip().lower()
    if value and not _LANGUAGE.match(value):
        raise serializers.ValidationError("Use a language code such as en, hi or te.")
    return value


class TagsField(serializers.Field):
    """A list of tags, or a comma-separated string of them (as a multipart form sends)."""

    def to_internal_value(self, data):
        if not isinstance(data, (list, str)):
            raise serializers.ValidationError("Enter tags as a list or a comma-separated string.")
        tags = clean_tags(data)
        return tags

    def to_representation(self, value):
        return value


class KnowledgeBaseCreateSerializer(serializers.Serializer):
    workspace = serializers.UUIDField()
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    chat_enabled = serializers.BooleanField(required=False, default=False)
    default_language = serializers.CharField(max_length=16, required=False, default="en")

    def validate_default_language(self, value):
        return _language(value) or "en"


class KnowledgeBaseUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    chat_enabled = serializers.BooleanField(required=False)
    default_language = serializers.CharField(max_length=16, required=False)

    def validate_default_language(self, value):
        return _language(value) or "en"


class DocumentMetadataSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    category = serializers.CharField(max_length=100, required=False, allow_blank=True)
    tags = TagsField(required=False)
    language = serializers.CharField(max_length=16, required=False, allow_blank=True)
    author = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_language(self, value):
        return _language(value)

    def validate_category(self, value):
        return " ".join(value.split())


class DocumentUpdateSerializer(DocumentMetadataSerializer):
    def validate_title(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("A document needs a title.")
        return value


class UploadSerializer(DocumentMetadataSerializer):
    file = serializers.FileField(allow_empty_file=True, max_length=255)


class VersionUploadSerializer(serializers.Serializer):
    file = serializers.FileField(allow_empty_file=True, max_length=255)


class SourceCreateSerializer(DocumentMetadataSerializer):
    type = serializers.ChoiceField(choices=[SourceType.URL, SourceType.TEXT])
    url = serializers.CharField(max_length=2048, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["type"] == SourceType.URL:
            if not attrs.get("url", "").strip():
                raise serializers.ValidationError({"url": ["Enter the address of the page."]})
        else:
            if not attrs.get("title", "").strip():
                raise serializers.ValidationError({"title": ["Give the text a title."]})
            content = attrs.get("content", "")
            if not content.strip():
                raise serializers.ValidationError({"content": ["Enter the text to add."]})
            limit = settings.KNOWLEDGE_BASE["MAX_TEXT_CHARACTERS"]
            if len(content) > limit:
                raise serializers.ValidationError({"content": [f"Text is limited to {limit:,} characters."]})
        return attrs


class HistoryMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=8000, trim_whitespace=False)


class RetrievalFiltersSerializer(serializers.Serializer):
    document_ids = serializers.ListField(child=serializers.UUIDField(), required=False, max_length=100)
    categories = serializers.ListField(child=serializers.CharField(max_length=100), required=False, max_length=20)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, max_length=20)
    source_types = serializers.ListField(
        child=serializers.ChoiceField(choices=SourceType.choices), required=False, max_length=10
    )
    language = serializers.CharField(max_length=16, required=False, allow_blank=True)


class RagOptionsSerializer(serializers.Serializer):
    generate = serializers.BooleanField(required=False, default=True)
    final_k = serializers.IntegerField(required=False, min_value=1, max_value=20)
    rerank_top_k = serializers.IntegerField(required=False, min_value=1, max_value=100)
    dense_top_k = serializers.IntegerField(required=False, min_value=1, max_value=100)
    sparse_top_k = serializers.IntegerField(required=False, min_value=1, max_value=100)


class RagTestSerializer(serializers.Serializer):
    knowledge_base = serializers.UUIDField()
    question = serializers.CharField(max_length=4000)
    history = HistoryMessageSerializer(many=True, required=False, max_length=20)
    filters = RetrievalFiltersSerializer(required=False)
    options = RagOptionsSerializer(required=False)


class ChatSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=4000)
    history = HistoryMessageSerializer(many=True, required=False, max_length=20)
    # A knowledge base the caller may view — for testing one before it is
    # enabled — or a workspace, meaning every chat-enabled knowledge base in it.
    knowledge_base = serializers.UUIDField(required=False)
    workspace = serializers.UUIDField(required=False)
    conversation_id = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("knowledge_base") and not attrs.get("workspace"):
            raise serializers.ValidationError({"workspace": ["Choose a workspace or a knowledge base."]})
        return attrs


class PublicChatSerializer(serializers.Serializer):
    # A question and the conversation so far. What is searched is fixed by
    # configuration, so there is no field here that could choose it.
    message = serializers.CharField(max_length=4000)
    history = HistoryMessageSerializer(many=True, required=False, max_length=20)
