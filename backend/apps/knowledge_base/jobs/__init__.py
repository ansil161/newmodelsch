"""
Background processing for the knowledge base.

    queue.py   the durable queue on PostgreSQL, and how jobs are dispatched
    runner.py  what each kind of job does

Run the worker with `manage.py process_documents`. In development, setting
KB_TASK_DISPATCH=thread processes jobs in a background thread of the web
process instead, so `runserver` alone is enough to see a document through.
"""
