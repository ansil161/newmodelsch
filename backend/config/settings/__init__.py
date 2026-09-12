"""
Settings are split by environment:

    base.py         everything shared; production-safe defaults
    development.py  runserver on localhost
    production.py   refuses to start with an unsafe configuration
    test.py         deterministic settings for the test suite
"""
