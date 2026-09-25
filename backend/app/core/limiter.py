from fastapi import Request
from slowapi import Limiter


def client_ip(request: Request) -> str:
    # Render's edge overwrites True-Client-IP with the address that connected
    # to it, so it can't be spoofed (X-Forwarded-For can). Absent in local dev,
    # where the direct connection address is used instead.
    true_client_ip = request.headers.get("true-client-ip")
    if true_client_ip:
        return true_client_ip
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip, key_style="endpoint")