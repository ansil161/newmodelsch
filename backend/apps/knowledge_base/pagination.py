"""Page-number pagination inside the standard success envelope."""

import math

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def _positive(value, default):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number if number > 0 else default


def paginate(request, queryset, present, *, default_size=DEFAULT_PAGE_SIZE):
    size = min(_positive(request.query_params.get("page_size"), default_size), MAX_PAGE_SIZE)
    total = queryset.count()
    pages = max(1, math.ceil(total / size))
    page = min(_positive(request.query_params.get("page"), 1), pages)
    items = queryset[(page - 1) * size: page * size]
    return {
        "results": [present(item) for item in items],
        "pagination": {"page": page, "page_size": size, "total": total, "total_pages": pages},
    }
