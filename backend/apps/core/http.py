import ipaddress

from rest_framework.settings import api_settings


def get_client_ip(request):
    """
    The client's address, trusting exactly NUM_PROXIES (TRUSTED_PROXY_COUNT)
    hops of X-Forwarded-For - the same rule DRF's throttles apply.

    With no trusted proxies the header is ignored entirely: anyone can send
    X-Forwarded-For, so reading it unconditionally would let a client choose
    the address it is rate-limited and logged under.
    """
    remote_addr = request.META.get("REMOTE_ADDR", "")
    num_proxies = api_settings.NUM_PROXIES
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if not num_proxies or not forwarded_for:
        return remote_addr
    addresses = [address.strip() for address in forwarded_for.split(",") if address.strip()]
    if not addresses:
        return remote_addr
    return addresses[-min(num_proxies, len(addresses))]


def rate_limit_key(ip):
    """
    The identity a client is rate-limited under. IPv6 is bucketed by /64:
    one subscriber normally holds a whole /64 and could otherwise rotate
    addresses faster than any per-address limit counts them.
    """
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return ip or "unknown"
    if address.version == 6:
        if address.ipv4_mapped:
            return str(address.ipv4_mapped)
        return str(ipaddress.ip_network(f"{address}/64", strict=False))
    return str(address)
