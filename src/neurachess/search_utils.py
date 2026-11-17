import time


class SearchTimeout(Exception):
    pass


def check_timeout(deadline: float) -> None:
    if time.perf_counter() >= deadline:
        raise SearchTimeout
