"""
WSGI entry point, e.g. `gunicorn config.wsgi`.

Defaults to production settings: a server process should never come up in
development mode because a variable was left unset.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_wsgi_application()
