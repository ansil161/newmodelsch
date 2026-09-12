"""
The API's response envelope.

    success   {"success": true,  "message": str, "data": {...}}
    failure   {"success": false, "message": str, "code": str, "errors": {...}}

`message` is written for a person. `code` is stable and written for the
client's code to branch on. `errors` holds field-level validation messages.
"""

from rest_framework.response import Response

GENERIC_ERROR = "Something went wrong. Please try again."


def success(message, data=None, *, status=200):
    return Response({"success": True, "message": message, "data": data or {}}, status=status)


def failure(message, *, code, errors=None):
    return {"success": False, "message": message, "code": code, "errors": errors or {}}
