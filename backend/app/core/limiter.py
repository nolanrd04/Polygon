import ipaddress

from fastapi import Request
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from slowapi import Limiter


def _group_ipv6(ip: str) -> str:
    # One IPv6 home/device gets a whole /64 and can rotate addresses inside it,
    # so the /64 is treated as one client. IPv4 is returned unchanged.
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if isinstance(addr, ipaddress.IPv6Address):
        if addr.ipv4_mapped:
            return str(addr.ipv4_mapped)
        return str(ipaddress.ip_network(f"{addr}/64", strict=False))
    return ip


def client_ip(request: Request) -> str:
    # Render's edge overwrites True-Client-IP with the address that connected to it, so it can't be spoofed (X-Forwarded-For can).
    # Absent in local dev, where the direct connection address is used instead.
    true_client_ip = request.headers.get("true-client-ip")
    if true_client_ip:
        return _group_ipv6(true_client_ip)
    return _group_ipv6(request.client.host) if request.client else "unknown"


# moving-window: exact "N in any rolling window". The default fixed-window resets a fixed time after it opens, allowing 2x the limit in a burst across the reset.
limiter = Limiter(key_func=client_ip, key_style="endpoint", strategy="moving-window")

# Failed-login counters, hit manually in the login route: the decorator runs
# before the body is parsed and can't tell a wrong password from a right one.
failed_login_limiter = MovingWindowRateLimiter(MemoryStorage())
FAILED_LOGINS_PER_ACCOUNT = parse("5 per 5 minutes")  # per IP + username: brute force
FAILED_LOGINS_PER_IP = parse("30 per 10 minutes")     # any username: password spraying