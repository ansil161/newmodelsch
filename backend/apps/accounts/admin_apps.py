"""
The admin's AppConfig, pointed at ThrottledAdminSite.

Kept in its own module because INSTALLED_APPS imports it while the app
registry is still loading: the site is referenced by dotted path and only
imported once everything is ready.
"""

from django.contrib.admin.apps import AdminConfig


class ThrottledAdminConfig(AdminConfig):
    default_site = "apps.accounts.admin_site.ThrottledAdminSite"
